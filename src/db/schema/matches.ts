import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { catalogProfiles } from "@/src/db/schema/catalog";

/**
 * A durable 1:1 chat match between the local member and one catalog profile
 * (REQUIREMENTS §3.6, §2.1.3). Created two ways:
 * - a simulated mutual-like: a `like` drains to the mock server, the server
 *   emits a realtime `matches:new` event, and the chat consumer reconciles it
 *   into a row here;
 * - the deterministic first-run demo seed (`seedChatIfEmpty`), which guarantees
 *   three matches pre-exist so list/paging/unread features are demonstrable.
 *
 * `lastReadAt` is the local member's read watermark: unread count = incoming
 * messages with `createdAt > lastReadAt`. The partner's identity lives in
 * `profileId` (FK → catalog_profiles), which also carries the display name and
 * avatar.
 */
export const matches = sqliteTable(
  "matches",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => catalogProfiles.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    /** When the local member last had this thread open; null = never opened. */
    lastReadAt: integer("last_read_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("matches_profile_id_idx").on(table.profileId)]
);

export type MatchRow = typeof matches.$inferSelect;