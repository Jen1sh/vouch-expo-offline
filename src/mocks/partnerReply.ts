import { isOffline } from "@/src/network/connectivity";

import { emit } from "@/src/realtime/publishes";

import { getControlsSnapshot } from "./devPanelControls";

/**
 * Simulated partner reply engine (REQUIREMENTS §3.6/§4.3). When the Dev-Panel
 * "Auto-reply" toggle is ON, each successfully drained `sendMessage` schedules
 * a partner reply through the same realtime channel the app already consumes —
 * so incoming messages travel the real, deliberately-unreliable event path
 * (dedupe, out-of-order window, duplicate rate) instead of a local fake timer
 * writing directly to the DB. The reply body is a deterministic canned line.
 * Replies are only scheduled while online (real or simulated); `emit` also
 * drops anything fired while the network is out.
 */

const REPLY_LINES = [
  "That sounds lovely — tell me more?",
  "Ha! I needed that today.",
  "Obviously you're right. What about Tuesday?",
  "Wait, seriously? Say more.",
  "Okay that's a good point.",
  "I was just thinking the same thing.",
  "Deal — but you're buying the coffee then.",
  "You have my attention.",
] as const;

let replyCursor = 0;

export function nextIncomingLine(): string {
  const line = REPLY_LINES[replyCursor % REPLY_LINES.length];
  replyCursor += 1;
  return line;
}

export function resetPartnerReplyCursor(): void {
  replyCursor = 0;
}

const pendingReplyTimers = new Set<ReturnType<typeof setTimeout>>();

/** Deterministic reply delay band (2.5–6s) so it feels like the "server". */
function replyDelayMs(): number {
  return 2500 + Math.floor(Math.random() * 3500);
}

/**
 * Schedules a partner reply for `matchId` if auto-reply is enabled. The reply
 * is emitted as a real `messages:new` event; the consumer fills in the sender
 * (the match's partner) and reconciles against optimistic state.
 */
export function maybeSchedulePartnerReply(matchId: string | undefined): void {
  if (!matchId || typeof matchId !== "string") {
    return;
  }
  if (!getControlsSnapshot().autoReply) {
    return;
  }
  if (isOffline()) {
    return;
  }

  const timer = setTimeout(() => {
    pendingReplyTimers.delete(timer);
    emitIncoming(matchId);
  }, replyDelayMs());
  pendingReplyTimers.add(timer);
}

export function emitIncoming(matchId: string): void {
  emit({ type: "messages:new", matchId, messageId: `server-${Date.now()}-${counter()}`, body: nextIncomingLine() });
}

let replyCounter = 0;
function counter(): string {
  replyCounter += 1;
  return String(replyCounter);
}

/** Dev Panel: cancel all pending auto-replies (used on reset). */
export function cancelPendingReplies(): void {
  for (const timer of pendingReplyTimers) {
    clearTimeout(timer);
  }
  pendingReplyTimers.clear();
}