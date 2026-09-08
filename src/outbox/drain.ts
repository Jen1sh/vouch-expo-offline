import { AppState } from "react-native";

import { showAppToast } from "@/src/components/AppToast";
import { db } from "@/src/db/client";
import { ensureMigrated } from "@/src/db/migrate";
import {
  failMessageSend,
  getMessageForOutboxItem,
  markMessageSent,
  rescheduleMessageSend,
  setMessageStatus,
  transitionMessageToSending,
} from "@/src/db/queries/messages.queries";
import {
  claimNextDueItem,
  failOutboxItem,
  markOutboxItemDone,
  recoverInFlightItems,
  scheduleOutboxRetry,
} from "@/src/db/queries/outbox.queries";
import type { OutboxItemRow } from "@/src/db/schema/outbox";
import { setMessageStatusMirror } from "@/src/features/chat/store/message-status";
import { isOffline, subscribeOffline } from "@/src/network/connectivity";
import { maybeEmitMatchOnLike } from "@/src/mocks/reciprocity";
import { maybeSchedulePartnerReply } from "@/src/mocks/partnerReply";
import { NetworkOfflineError, request } from "@/src/mocks/server";
import { exceedsAttemptCap, nextBackoffDelayMs } from "@/src/outbox/backoff";

/** The one HTTP-ish path every drained outbox action posts to. */
const OUTBOX_SYNC_PATH = "/outbox";

/**
 * Single-flight, strictly-ordered drain worker (REQUIREMENTS §4.1). At most
 * one drain loop runs at any time; items are claimed (`queued → sending`)
 * inside a transaction and delivered in `createdAt` order. A network failure
 * backs the item off (exponential + jitter, capped at `failed`) and STOPS the
 * loop so a later item can never overtake an earlier one on the server.
 * A new drain is kicked off on enqueue, app foreground, and offline→online.
 *
 * Chat (`type: "sendMessage"`) rides the same loop: the message mirror advances
 * `queued → sending → sent/failed` in step with the outbox item, switching
 * through the paired-query helpers so each state bump is one transaction.
 * Items stranded in `sending` by an offline interrupt or hard kill are
 * recovered to `queued` at the top of every drain — exactly-once is preserved
 * across relaunch.
 *
 * Boot resilience (REQUIREMENTS §4.7-2): a cold-start drain that THROWS is
 * never left silent — the trigger re-schedules itself on the wake timer with
 * exponential backoff (30s cap) until it succeeds, so the queue self-heals
 * instead of stalling after a hard kill even when no enqueue/foreground/
 * connectivity edge ever fires again. Lifecycle-triggered drains that actually
 * flush items surface a "Synced N queued actions" toast (enqueue-time drains
 * stay silent so the online fast path doesn't spam).
 */

export type DrainResult = { completed: number };

type DrainOptions = { notify?: boolean };

let draining = false;
let wakeTimer: ReturnType<typeof setTimeout> | null = null;
let watcherStarted = false;
let bootAttempts = 0;

type SendResult =
  | { outcome: "done" | "failed" }
  | { outcome: "blocked"; blockedBy: "offline" | "backoff"; wakeAtMs?: number };

/** Fires the drain loop while ensuring only one runs at a time. */
export async function attemptDrain(options: DrainOptions = {}): Promise<DrainResult> {
  if (draining) {
    return { completed: 0 };
  }
  draining = true;
  try {
    await ensureMigrated();
    await recoverStaleInFlight();
    const completed = await drainLoop();
    if (options.notify && completed > 0) {
      showAppToast("success", `Synced ${completed} queued action${completed === 1 ? "" : "s"}`);
    }
    return { completed };
  } finally {
    draining = false;
  }
}

/**
 * Requeues outbox items a previous process/cycle left `sending` (offline
 * interrupt or a hard kill mid-request) and mirrors their messages back to
 * `queued`. Runs under the single-flight lock so nothing else can be sending.
 */
async function recoverStaleInFlight(): Promise<void> {
  const recovered = await recoverInFlightItems(new Date());
  for (const row of recovered) {
    const messageId = payloadMessageId(row);
    if (messageId) {
      await setMessageStatus(db, messageId, "queued", new Date());
      setMessageStatusMirror(messageId, "queued");
    }
  }
}

function payloadMessageId(item: OutboxItemRow): string | undefined {
  return item.type === "sendMessage" && typeof item.payload?.messageId === "string"
    ? item.payload.messageId
    : undefined;
}

async function drainLoop(): Promise<number> {
  let completed = 0;
  for (;;) {
    const item = await claimNextDueItem(new Date(), undefined, async (tx, claimed) => {
      const messageId = payloadMessageId(claimed);
      const message = messageId
        ? await getMessageForOutboxItem(claimed.id, tx)
        : undefined;
      if (message) {
        await transitionMessageToSending(tx, message.id, new Date());
        setMessageStatusMirror(message.id, "sending");
      }
    });
    if (!item) {
      return completed;
    }

    const result = await send(item);
    if (result.outcome === "done") {
      completed += 1;
      continue;
    }
    if (result.outcome === "failed") {
      continue;
    }

    // Blocked: offline, or preserving FIFO order behind a backoff. Reschedule.
    if (result.outcome === "blocked" && result.blockedBy === "backoff" && result.wakeAtMs) {
      scheduleWake(result.wakeAtMs);
    }
    return completed;
  }
}

async function send(item: OutboxItemRow): Promise<SendResult> {
  const messageId = payloadMessageId(item);

  try {
    await request({
      path: OUTBOX_SYNC_PATH,
      method: "POST",
      body: { type: item.type, payload: item.payload, idempotencyKey: item.idempotencyKey },
    });

    if (messageId) {
      await markMessageSent(item.id, messageId, new Date());
      setMessageStatusMirror(messageId, "sent");
    } else {
      await markOutboxItemDone(item.id, new Date());
    }

    if (item.type === "like") {
      const profileId = item.payload.profileId;
      if (typeof profileId === "string") {
        void maybeEmitMatchOnLike(profileId);
      }
    }
    if (item.type === "sendMessage") {
      const matchId = item.payload.matchId;
      if (typeof matchId === "string") {
        void maybeSchedulePartnerReply(matchId);
      }
    }
    return { outcome: "done" };
  } catch (error) {
    if (error instanceof NetworkOfflineError) {
      // Nothing transient about it — pause until connectivity returns. The
      // item is left `sending`; the next drain start recovers it to `queued`.
      return { outcome: "blocked", blockedBy: "offline" };
    }

    const errorText = error instanceof Error ? error.message : String(error);
    const attempts = item.attempts + 1;
    if (exceedsAttemptCap(attempts)) {
      if (messageId) {
        await failMessageSend(item.id, messageId, attempts, errorText, new Date());
        setMessageStatusMirror(messageId, "failed");
      } else {
        await failOutboxItem(item.id, attempts, errorText, new Date());
      }
      return { outcome: "failed" };
    }

    const delayMs = nextBackoffDelayMs(attempts);
    const wakeAt = Date.now() + delayMs;
    if (messageId) {
      await rescheduleMessageSend(
        item.id,
        messageId,
        { attempts, nextAttemptAt: new Date(wakeAt) },
        errorText,
        new Date()
      );
      setMessageStatusMirror(messageId, "queued");
    } else {
      await scheduleOutboxRetry(item.id, attempts, new Date(wakeAt), errorText, new Date());
    }
    return { outcome: "blocked", blockedBy: "backoff", wakeAtMs: wakeAt };
  }
}

function scheduleWake(ms: number): void {
  if (wakeTimer !== null) {
    clearTimeout(wakeTimer);
  }
  // Clamp so an absurd backoff can never hold the timer open forever.
  wakeTimer = setTimeout(() => {
    wakeTimer = null;
    scheduleDrainAttempt();
  }, Math.min(ms, 30_000));
}

/**
 * Fires a drain such that a rejection is never swallowed silently: it is
 * logged with context and re-scheduled on the wake timer (exponential backoff,
 * 30s cap) until a run completes, and the backoff resets on success. This is
 * what makes a boot-after-kill self-heal even when nothing else ever triggers.
 */
function scheduleDrainAttempt(options: DrainOptions = {}): void {
  void attemptDrain(options)
    .then(() => {
      bootAttempts = 0;
    })
    .catch((error) => {
      console.warn("[outbox] drain attempt failed; will retry:", error);
      bootAttempts += 1;
      scheduleWake(nextBackoffDelayMs(bootAttempts));
    });
}

/**
 * Wires the drain triggers once per process: app start, foreground, and the
 * combined offline channel flipping back online (Dev Panel toggle or real
 * connectivity). Safe to call repeatedly.
 */
export function startOutboxWatcher(): void {
  if (watcherStarted) {
    return;
  }
  watcherStarted = true;

  scheduleDrainAttempt({ notify: true });

  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      scheduleDrainAttempt({ notify: true });
    }
  });

  subscribeOffline(() => {
    if (!isOffline()) {
      scheduleDrainAttempt({ notify: true });
    }
  });

  // Close the ordering window where connectivity flipped back online before
  // the listeners above registered: if we are already online, nudge once more
  // (single-flight, so this is dead cheap when a drain just ran).
  if (!isOffline()) {
    scheduleDrainAttempt({ notify: true });
  }
}

export function isDraining(): boolean {
  return draining;
}

/** Test-only: forget watcher/lock state and clear any pending wake timer. */
export function __resetOutboxWatcherForTests(): void {
  if (wakeTimer !== null) {
    clearTimeout(wakeTimer);
    wakeTimer = null;
  }
  draining = false;
  watcherStarted = false;
  bootAttempts = 0;
}