import type { RealtimeEvent } from "./realtimeChannel";

/**
 * Consumer-side dedupe for the deliberately-unreliable realtime channel
 * (REQUIREMENTS §4.3): drops an event whose id was already seen, so a
 * duplicated delivery or a replayed event never reaches a reducer twice.
 * An out-of-order old event is also rejected — never overwriting newer local
 * state with a stale arrival.
 */
export function createEventDedupe() {
  const seenIds = new Set<string>();
  let lastSeenTimestamp = 0;

  return {
    /** Returns `true` when the event should be applied (first time, in order). */
    accept(event: RealtimeEvent): boolean {
      if (seenIds.has(event.id)) {
        return false;
      }
      if (event.occurredAt < lastSeenTimestamp) {
        return false;
      }
      seenIds.add(event.id);
      lastSeenTimestamp = event.occurredAt;
      return true;
    },
  };
}

export type EventDedupe = ReturnType<typeof createEventDedupe>;