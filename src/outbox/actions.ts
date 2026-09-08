import * as Crypto from "expo-crypto";

import type { DecisionDirection } from "@/src/db/schema/swipes";

/**
 * Every client-initiated mutation the app can enqueue. Each variant has a
 * unique `type`, a typed payload, and — per CONVENTIONS §8.12 — the
 * `idempotencyKey` is generated at enqueue time, never at drain time.
 */
export type OutboxAction =
  | { type: "like"; profileId: string }
  | { type: "skip"; profileId: string }
  | { type: "askVoucher"; profileId: string }
  /** Compensating write when Undo fired after the original decision already left the queue. */
  | { type: "undoDecision"; profileId: string }
  /** Optimistic chat message; the linked `messages` row carries the send state. */
  | { type: "sendMessage"; matchId: string; messageId: string; body: string }
  /** Voucher shortlists a candidate on behalf of the person they represent. */
  | { type: "shortlist"; profileId: string }
  /** Compensating write when Remove fires after the add already left the queue. */
  | { type: "unshortlist"; profileId: string }
  /** Latest vouch note for a shortlisted candidate; last-write-wins on the server. */
  | { type: "updateVouchNote"; profileId: string; note: string };

export type OutboxActionType = OutboxAction["type"];

/** Payload-only shape persisted in `outbox_items.payload` next to `type`. */
export type OutboxActionPayload =
  | { profileId: string; direction: DecisionDirection }
  | { profileId: string }
  | { matchId: string; messageId: string; body: string }
  | { profileId: string; note: string };

/** One fully-formed outbox write, complete with durable identity. */
export type OutboxWrite = {
  id: string;
  type: OutboxActionType;
  payload: OutboxActionPayload;
  idempotencyKey: string;
  createdAt: Date;
};

export function newIdempotencyKey(): string {
  return Crypto.randomUUID();
}

/** Maps an action to the JSON payload stored alongside its `type` column. */
export function toPayload(action: OutboxAction): OutboxActionPayload {
  switch (action.type) {
    case "like":
    case "skip":
    case "askVoucher":
      return { profileId: action.profileId, direction: action.type };
    case "undoDecision":
    case "shortlist":
    case "unshortlist":
      return { profileId: action.profileId };
    case "sendMessage":
      return { matchId: action.matchId, messageId: action.messageId, body: action.body };
    case "updateVouchNote":
      return { profileId: action.profileId, note: action.note };
  }
}