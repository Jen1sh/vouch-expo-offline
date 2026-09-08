import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * App-wide preferences (REQUIREMENTS §3.8) keyed by a constant string so the
 * Settings screen, the theme bridge and the language bridge all read one row
 * per preference. Values are stored as their serialized primitive — "light",
 * "dark", "system" for theme and "en"/"ar" for language — because the schema
 * rule is no JSON columns; the typed accessors in `settings.queries.ts` map
 * them to their TS union types. `updatedAt` keeps the last-writer's clock for
 * the "theme/language picker bounces between two devices" edge.
 */
export const APP_SETTING_KEYS = [
  "themeMode",
  "language",
  "notificationsEnabled",
] as const;
export type AppSettingKey = (typeof APP_SETTING_KEYS)[number];

export const SETTING_DEFAULTS: Record<AppSettingKey, string> = {
  themeMode: "system",
  language: "en",
  notificationsEnabled: "false",
};

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type AppSettingRow = typeof appSettings.$inferSelect;