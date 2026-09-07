import { db } from "@/src/db/client";
import { getMatch } from "@/src/db/queries/matches.queries";
import { getControlsSnapshot } from "../mocks/devPanelControls";
import { nextIncomingLine } from "../mocks/partnerReply";
import { matchIdForProfile, reciprocates } from "../mocks/reciprocity";
import { SEED_PROFILES } from "../mocks/seed/profiles";

/**
 * Simulated realtime events (REQUIREMENTS §4.3). The channel deliberately
 * reflects the Dev-Panel duplicate rate and out-of-order window: an emitted
 * event may be delivered twice or held back behind others. Consumers dedupe
 * by `id` and reconcile against optimistic local state (see `dedupe.ts`).
 */

export type RealtimeEvent =
  | { type: "matches:new"; id: string; matchId: string; profileId: string; occurredAt: number }
  | { type: "messages:new"; id: string; matchId: string; messageId: string; senderId?: string; body: string; occurredAt: number }
  | { type: "typing"; id: string; matchId: string; userId: string; occurredAt: number }
  | { type: "profiles:updated"; id: string; userId: string; occurredAt: number };

export type RealtimeListener = (event: RealtimeEvent) => void;

const listeners = new Set<RealtimeListener>();
let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}-${Date.now()}`;
}

let lastEmittedEvent: RealtimeEvent | null = null;

function dispatch(event: RealtimeEvent): void {
  lastEmittedEvent = event;
  for (const listener of listeners) {
    listener(event);
  }
}

/**
 * Delivers an event, applying the configured duplicate rate and a small
 * out-of-order window: the event is scheduled with a random hold (0..window)
 * and, on a duplicate roll, fired again after the first delivery.
 */
function deliver(event: RealtimeEvent): void {
  const controls = getControlsSnapshot();
  const holdMs = Math.round(Math.random() * controls.outOfOrderWindow * 50);

  setTimeout(() => {
    dispatch(event);
    if (Math.random() < controls.duplicateRate) {
      setTimeout(() => dispatch(event), holdMs);
    }
  }, holdMs);
}

type RealtimeEventInput =
  | { type: "matches:new"; matchId: string; profileId: string }
  | { type: "messages:new"; matchId: string; messageId: string; senderId?: string; body: string }
  | { type: "typing"; matchId: string; userId: string }
  | { type: "profiles:updated"; userId: string };

function toEvent(input: RealtimeEventInput): RealtimeEvent {
  const base = { id: nextId(input.type), occurredAt: Date.now() };
  switch (input.type) {
    case "matches:new":
      return { ...base, type: input.type, matchId: input.matchId, profileId: input.profileId };
    case "messages:new": {
      const event = { ...base, type: input.type as "messages:new", matchId: input.matchId, messageId: input.messageId, body: input.body };
      return input.senderId ? { ...event, senderId: input.senderId } : event;
    }
    case "typing":
      return { ...base, type: input.type, matchId: input.matchId, userId: input.userId };
    case "profiles:updated":
      return { ...base, type: input.type, userId: input.userId };
  }
  throw new Error(`Unreachable event type: ${String(input)}`);
}

/** Sends an event as if it arrived from the "network". */
export function emit(input: RealtimeEventInput): void {
  deliver(toEvent(input));
}

export function subscribeToRealtime(listener: RealtimeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const forceMatchCursor = { value: 0 };

/**
 * Dev Panel: push a fresh `new match` event for an unused seed profile.
 * Cycles deterministically through the catalog (skipping the three demo-match
 * partners) so repeated presses keep producing genuinely-new matches.
 */
export function forceMatchEvent(): void {
  const candidates = SEED_PROFILES.slice(3);
  const probe = candidates[forceMatchCursor.value % candidates.length];
  forceMatchCursor.value += 1;
  emit({
    type: "matches:new",
    matchId: matchIdForProfile(probe.id),
    profileId: probe.id,
  });
}

/**
 * Dev Panel: push one genuine incoming message for a match. Resolves the
 * partner's profile so the event carries a real `senderId`, then sends it down
 * the normal realtime path (dedupe/reorder applied) so it behaves identically
 * to a server-pushed message.
 */
export async function forceIncomingMessage(matchId: string): Promise<void> {
  const match = await getMatch(db, matchId);
  if (!match) {
    return;
  }
  emit({
    type: "messages:new",
    matchId,
    messageId: `manual-${nextId("incoming")}`,
    senderId: match.profileId,
    body: nextIncomingLine(),
  });
}

/** Dev Panel: push a `typing` indicator for a match's partner. */
export async function simulateTyping(matchId: string): Promise<void> {
  const match = await getMatch(db, matchId);
  if (!match) {
    return;
  }
  emit({ type: "typing", matchId, userId: match.profileId });
}

/** Dev Panel: push a duplicate of the most recent emitted event. */
export function forceDuplicateEvent(): void {
  if (lastEmittedEvent) {
    dispatch({ ...lastEmittedEvent });
  }
}

export function getLastEmittedEvent(): RealtimeEvent | null {
  return lastEmittedEvent;
}

/** Used by tests + Dev Panel to prove reciprocity produces match events. */
export function simulateReciprocalLike(profileId: string): boolean {
  if (!reciprocates(profileId)) {
    return false;
  }
  emit({ type: "matches:new", matchId: matchIdForProfile(profileId), profileId });
  return true;
}