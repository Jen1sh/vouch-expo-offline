import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Durable outbox of this device's mutating actions (REQUIREMENTS §4.1). Every
 * action is written here, durably, before any network attempt; `src/outbox/`
 * is the only place that ever reads from a network response. Rows live in the
 * order they were created (rowid order) and are drained oldest-first by a
 * single-flight worker.
 *
 * Status lifecycle:
 * - `queued`  → waiting to be sent, possibly with a `nextAttemptAt` backoff.
 * - `sending` → claimed by the drain worker while the network call is in flight.
 * - `done`    → server accepted the action (idempotency key means a replay can
 *               never apply it twice).
 * - `failed`  → exhausted the retry cap; surfaced to the user, never dropped.
 */
export const OUTBOX_STATUS = ["queued", "sending", "done", "failed"] as const;
export type OutboxStatus = (typeof OUTBOX_STATUS)[number];

export const outboxItems = sqliteTable(
  "outbox_items",
  {
    id: text("id").primaryKey(),
    /** Discriminated action type: like | skip | askVoucher | undoDecision | sendMessage | shortlist | unshortlist | updateVouchNote. */
    type: text("type").notNull(),
    /** Action payload without `type`/`idempotencyKey`; JSON because each action has its own shape. */
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    /** Client-generated at enqueue time, never at drain time. Unique by constraint. */
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").$type<OutboxStatus>().notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    /** When a failed item may next be retried (null = eligible immediately). */
    nextAttemptAt: integer("next_attempt_at", { mode: "timestamp_ms" }),
    lastError: text("last_error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("outbox_items_idempotency_key_idx").on(table.idempotencyKey),
    index("outbox_items_status_next_attempt_idx").on(table.status, table.nextAttemptAt),
    index("outbox_items_created_at_idx").on(table.createdAt),
  ]
);

export type OutboxItemRow = typeof outboxItems.$inferSelect;