import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * The local user's profile, produced by onboarding and read by Discover /
 * Browse / Profile later. There is no backend account id yet (single local
 * account), so the row is keyed by the constant `MY_PROFILE_ID`.
 *
 * Onboarding writes fields as a resumable draft against this single row:
 * - `onboardingStep` persists which of the 4 steps the user is on (0 = none).
 * - `onboardingCompleted` flips to true when step 4 is submitted.
 * Photos and multi-select preferences are normalized into related tables
 * rather than JSON columns (CONVENTIONS.md §8).
 */
export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  dateOfBirth: text("date_of_birth").notNull().default(""),
  city: text("city").notNull().default(""),
  bio: text("bio").notNull().default(""),
  lookingFor: text("looking_for").notNull().default(""),
  familyInvolved: text("family_involved").notNull().default(""),
  waliContact: text("wali_contact").notNull().default(""),
  familyRelationship: text("family_relationship").notNull().default(""),
  onboardingStep: integer("onboarding_step").notNull().default(0),
  onboardingCompleted: integer("onboarding_completed", { mode: "boolean" })
    .notNull()
    .default(false),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const profilePhotos = sqliteTable(
  "profile_photos",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    uri: text("uri").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [index("profile_photos_profile_id_idx").on(table.profileId)]
);

export const profilePreferences = sqliteTable(
  "profile_preferences",
  {
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    preference: text("preference").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.profileId, table.preference] }),
    index("profile_preferences_profile_id_idx").on(table.profileId),
  ]
);

export type ProfileRow = typeof profiles.$inferSelect;