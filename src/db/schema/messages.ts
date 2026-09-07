import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { matches } from "@/src/db/schema/matches";

export const MESSAGE_STATUSES = ["queued", "sending", "sent", "failed"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/**
 * The local mirror of every message in every match thread (REQUIREMENTS §3.6).
 *
 * Outgoing messages (the local member as sender) carry a transport state that
 * mirrors the linked outbox item's lifecycle: `queued` (enqueued, not yet on
 * the wire) → `sending` (claimed by the drain worker) → `sent` (server acked)
 * or `failed` (retry cap exhausted). Incoming messages are always `sent` —
 * the states exist only for the sender's side. The `messages` row and its
 * outbox item are written together in one transaction at enqueue, and the
 * drain updates the message status in the same transaction as the outbox
 * status so the two can never drift.
 */
export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    /** Catalog profile id of the sender; the local member's id is `me`. */
    senderId: text("sender_id").notNull(),
    body: text("body").notNull(),
    status: text("status").$type<MessageStatus>().notNull().default("sent"),
    /** Links an outgoing message to the outbox item that drives its state. */
    outboxItemId: text("outbox_item_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("messages_match_id_created_at_idx").on(table.matchId, table.createdAt),
    index("messages_match_id_status_idx").on(table.matchId, table.status),
  ]
);

export type MessageRow = typeof messages.$inferSelect;