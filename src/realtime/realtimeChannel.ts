import { getControlsSnapshot } from "../mocks/devPanelControls";

/**
 * Simulated realtime events (REQUIREMENTS §4.3). The channel deliberately
 * reflects the Dev-Panel duplicate rate and out-of-order window: an emitted
 * event may be delivered twice or held back behind others. Consumers dedupe
 * by `id` and reconcile against optimistic local state (see `dedupe.ts`).
 */

export type RealtimeEvent =
  | { type: "matches:new"; id: string; matchId: string; occurredAt: number }
  | { type: "messages:new"; id: string; matchId: string; messageId: string; occurredAt: number }
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
  | { type: "matches:new"; matchId: string }
  | { type: "messages:new"; matchId: string; messageId: string }
  | { type: "typing"; matchId: string; userId: string }
  | { type: "profiles:updated"; userId: string };

function toEvent(input: RealtimeEventInput): RealtimeEvent {
  const base = { id: nextId(input.type), occurredAt: Date.now() };
  switch (input.type) {
    case "matches:new":
      return { ...base, type: input.type, matchId: input.matchId };
    case "messages:new":
      return { ...base, type: input.type, matchId: input.matchId, messageId: input.messageId };
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

/** Dev Panel: push a fresh `new match` event. */
export function forceMatchEvent(): void {
  emit({ type: "matches:new", matchId: `match-${nextId("m")}` });
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