import type { RealtimeEvent } from "./realtimeChannel";

export type { RealtimeEvent, RealtimeListener } from "./realtimeChannel";

/** Discriminated-union payload extractors for typed switch handling. */
export type RealtimeEventType = RealtimeEvent["type"];