import { isOffline } from "@/src/network/connectivity";

import { getControlsSnapshot } from "../mocks/devPanelControls";

/**
 * The public event surface of the simulated realtime layer (REQUIREMENTS §4.3).
 * Split out from `realtimeChannel` so the mock engines can emit events without
 * importing the channel (which depends back on them for its Dev-Panel helpers)
 * — keeps the module graph acyclic. The channel re-exports everything here for
 * back-compat; consumers should prefer this module directly.
 *
 * The channel deliberately reflects the Dev-Panel duplicate rate and
 * out-of-order window: an emitted event may be delivered twice or held back
 * behind others. Consumers dedupe by `id` and reconcile against optimistic
 * local state (see `dedupe.ts`).
 *
 * While offline (Dev-Panel toggle or real connectivity) `emit` drops the event:
 * a dead network delivers nothing.
 */

export type RealtimeEvent =
  | { type: "matches:new"; id: string; matchId: string; profileId: string; occurredAt: number }
  | { type: "messages:new"; id: string; matchId: string; messageId: string; senderId?: string; body: string; occurredAt: number }
  | { type: "typing"; id: string; matchId: string; userId: string; occurredAt: number }
  | { type: "profiles:updated"; id: string; userId: string; occurredAt: number };

export type RealtimeListener = (event: RealtimeEvent) => void;

const listeners = new Set<RealtimeListener>();
let sequence = 0;

/** Event-id generator (exported for Dev-Panel helpers that craft ids). */
export function nextId(prefix: string): string {
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

export type RealtimeEventInput =
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

/** Sends an event as if it arrived from the "network". No-op while offline. */
export function emit(input: RealtimeEventInput): void {
  if (isOffline()) {
    return;
  }
  deliver(toEvent(input));
}

export function subscribeToRealtime(listener: RealtimeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
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