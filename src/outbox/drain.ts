import { AppState } from "react-native";

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
import { getControlsSnapshot, subscribeControls } from "@/src/mocks/devPanelControls";
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
 */

let draining = false;
let wakeTimer: ReturnType<typeof setTimeout> | null = null;
let watcherStarted = false;

type SendResult =
  | { outcome: "done" | "failed" }
  | { outcome: "blocked"; blockedBy: "offline" | "backoff"; wakeAtMs?: number };

/** Fires the drain loop while ensuring only one runs at a time. */
export async function attemptDrain(): Promise<void> {
  if (draining) {
    return;
  }
  draining = true;
  try {
    await ensureMigrated();
    await recoverStaleInFlight();
    await drainLoop();
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

async function drainLoop(): Promise<void> {
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
      return;
    }

    const result = await send(item);
    if (result.outcome === "done" || result.outcome === "failed") {
      continue;
    }

    // Blocked: offline, or preserving FIFO order behind a backoff. Reschedule.
    if (result.outcome === "blocked" && result.blockedBy === "backoff" && result.wakeAtMs) {
      scheduleWake(result.wakeAtMs);
    }
    return;
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
    void attemptDrain();
  }, Math.min(ms, 30_000));
}

/**
 * Wires the weekly triggers once per process: app start, foreground, and the
 * Dev Panel offline toggle flipping back online. Safe to call repeatedly.
 */
export function startOutboxWatcher(): void {
  if (watcherStarted) {
    return;
  }
  watcherStarted = true;

  void attemptDrain();

  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void attemptDrain();
    }
  });

  subscribeControls(() => {
    if (!getControlsSnapshot().offline) {
      void attemptDrain();
    }
  });
}

export function isDraining(): boolean {
  return draining;
}