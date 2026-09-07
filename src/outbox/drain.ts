import { AppState } from "react-native";

import { ensureMigrated } from "@/src/db/migrate";
import {
  claimNextDueItem,
  failOutboxItem,
  markOutboxItemDone,
  scheduleOutboxRetry,
} from "@/src/db/queries/outbox.queries";
import type { OutboxItemRow } from "@/src/db/schema/outbox";
import { getControlsSnapshot, subscribeControls } from "@/src/mocks/devPanelControls";
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
    await drainLoop();
  } finally {
    draining = false;
  }
}

async function drainLoop(): Promise<void> {
  for (;;) {
    const item = await claimNextDueItem(new Date());
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
  try {
    await request({
      path: OUTBOX_SYNC_PATH,
      method: "POST",
      body: { type: item.type, payload: item.payload, idempotencyKey: item.idempotencyKey },
    });
    await markOutboxItemDone(item.id, new Date());
    return { outcome: "done" };
  } catch (error) {
    if (error instanceof NetworkOfflineError) {
      // Nothing transient about it — pause until connectivity returns.
      return { outcome: "blocked", blockedBy: "offline" };
    }

    const messages = error instanceof Error ? error.message : String(error);
    const attempts = item.attempts + 1;
    if (exceedsAttemptCap(attempts)) {
      await failOutboxItem(item.id, attempts, messages, new Date());
      return { outcome: "failed" };
    }

    const delayMs = nextBackoffDelayMs(attempts);
    const wakeAt = Date.now() + delayMs;
    await scheduleOutboxRetry(item.id, attempts, new Date(wakeAt), messages, new Date());
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