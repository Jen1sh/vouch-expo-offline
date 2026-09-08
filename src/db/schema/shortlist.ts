import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { catalogProfiles } from "@/src/db/schema/catalog";

/**
 * A member's shortlist of candidates on behalf of the person they vouch for
 * (REQUIREMENTS §2.2/§3.7). One row per catalog profile — "not shortlisted"
 * is simply the absence of a row, the same framing as `swipes`. The row is an
 * optimistic mirror written in the same SQLite transaction as the
 * `shortlist`/`unshortlist` outbox enqueue, so this and the durable queue can
 * never disagree. `note` is the voucher's evolving vouch note (written via
 * `updateVouchNote`, also through the outbox); `outboxItemId` points at the
 * outbox item whose drain makes the add final, which lets a quick Remove look
 * up whether it can still roll the add back locally.
 */
export const shortlistedProfiles = sqliteTable(
  "shortlisted_profiles",
  {
    profileId: text("profile_id")
      .primaryKey()
      .references(() => catalogProfiles.id, { onDelete: "cascade" }),
    note: text("note").notNull().default(""),
    /** The outbox item whose drain makes the add final; null once removed locally. */
    outboxItemId: text("outbox_item_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("shortlisted_profiles_created_at_idx").on(table.createdAt)]
);

export type ShortlistRow = typeof shortlistedProfiles.$inferSelect;