import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * The seeded catalog of discoverable people (REQUIREMENTS §4.4 — ≥60 profiles)
 * mirrored into SQLite so list screens can paginate and filter in the database
 * rather than loading a JS array (CONVENTIONS §8). Populated idempotently from
 * the deterministic `SEED_PROFILES` catalog in `src/mocks/seed/profiles.ts`,
 * so Discover (in-memory deck) and Browse (SQLite list) show the same people.
 *
 * Multi-value fields are normalized into child tables (no JSON columns).
 * The columns Browse filters on — `age`, `distanceKm`, `verified` — are each
 * indexed so the WHERE clause never scans the whole table.
 */
export const catalogProfiles = sqliteTable(
  "catalog_profiles",
  {
    id: text("id").primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    age: integer("age").notNull(),
    city: text("city").notNull(),
    distanceKm: integer("distance_km").notNull(),
    verified: integer("verified", { mode: "boolean" }).notNull(),
    occupation: text("occupation").notNull(),
    bio: text("bio").notNull(),
  },
  (table) => [
    index("catalog_profiles_age_idx").on(table.age),
    index("catalog_profiles_distance_km_idx").on(table.distanceKm),
    index("catalog_profiles_verified_idx").on(table.verified),
  ]
);

export const catalogProfileInterests = sqliteTable(
  "catalog_profile_interests",
  {
    profileId: text("profile_id")
      .notNull()
      .references(() => catalogProfiles.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.profileId, table.tag] }),
    index("catalog_profile_interests_profile_id_idx").on(table.profileId),
  ]
);

export const catalogProfilePhotos = sqliteTable(
  "catalog_profile_photos",
  {
    profileId: text("profile_id")
      .notNull()
      .references(() => catalogProfiles.id, { onDelete: "cascade" }),
    uri: text("uri").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.profileId, table.uri] }),
    index("catalog_profile_photos_profile_id_idx").on(table.profileId),
  ]
);

export type CatalogProfileRow = typeof catalogProfiles.$inferSelect;