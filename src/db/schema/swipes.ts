import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Optimistic mirror of the local member's latest decision on each catalog
 * profile (REQUIREMENTS §4.1). One row per profile — the "undecided" state is
 * simply the absence of a row. Written in the same SQLite transaction as the
 * corresponding outbox enqueue, so a crash can never leave the mirror and the
 * outbox disagreeing. Last-write-wins by `updatedAt` resolves any conflict
 * against a future server record (rule documented in docs/TECHNICAL.md).
 */
export const DECISION_DIRECTIONS = ["like", "skip", "askVoucher"] as const;
export type DecisionDirection = (typeof DECISION_DIRECTIONS)[number];

export const swipes = sqliteTable("swipes", {
  profileId: text("profile_id").primaryKey(),
  direction: text("direction").$type<DecisionDirection>().notNull(),
  /** The outbox item whose drain makes this decision final; undo checks it. */
  outboxItemId: text("outbox_item_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type SwipeRow = typeof swipes.$inferSelect;