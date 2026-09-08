import { eq } from "drizzle-orm";

import { db, type DbClient, type DbTx } from "@/src/db/client";
import {
  SETTING_DEFAULTS,
  appSettings,
  type AppSettingKey,
  type AppSettingRow,
} from "@/src/db/schema/settings";

/**
 * The only place that reads or writes the `app_settings` key-value mirror
 * (CONVENTIONS §8.10). Values are stored serialized and mapped here to the
 * typed unions the Settings UI deals in (`themeMode`, `language`,
 * `notificationsEnabled`). Reads fall back to `SETTING_DEFAULTS` so an absent
 * row is identical to a freshly-written default.
 */

export type ThemeModeSetting = "light" | "dark" | "system";
export type LanguageSetting = "en" | "ar";

export type SettingsSnapshot = {
  themeMode: ThemeModeSetting;
  language: LanguageSetting;
  notificationsEnabled: boolean;
};

const THEME_MODES: ThemeModeSetting[] = ["light", "dark", "system"];
const LANGUAGES: LanguageSetting[] = ["en", "ar"];

function isThemeMode(value: string): value is ThemeModeSetting {
  return (THEME_MODES as string[]).includes(value);
}

function isLanguage(value: string): value is LanguageSetting {
  return (LANGUAGES as string[]).includes(value);
}

function parseSnapshot(rows: AppSettingRow[]): SettingsSnapshot {
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const themeMode = map.get("themeMode") ?? SETTING_DEFAULTS["themeMode"];
  const language = map.get("language") ?? SETTING_DEFAULTS["language"];
  const notifications = map.get("notificationsEnabled") ?? SETTING_DEFAULTS["notificationsEnabled"];
  return {
    themeMode: isThemeMode(themeMode) ? themeMode : "system",
    language: isLanguage(language) ? language : "en",
    notificationsEnabled: notifications === "true",
  };
}

export function upsertAppSetting(
  tx: DbTx,
  key: AppSettingKey,
  value: string,
  now: Date
): Promise<unknown> {
  return tx
    .insert(appSettings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: now },
    });
}

export function deleteAppSetting(tx: DbTx, key: AppSettingKey): Promise<unknown> {
  return tx.delete(appSettings).where(eq(appSettings.key, key));
}

export async function getAppSetting(
  client: DbClient,
  key: AppSettingKey
): Promise<string | undefined> {
  const [row] = await client.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return row?.value;
}

/** Materialized typed snapshot used to hydrate the in-memory settings store. */
export async function getSettingsSnapshot(): Promise<SettingsSnapshot> {
  const rows = await db.select().from(appSettings);
  return parseSnapshot(rows);
}

export function listAllAppSettings(): Promise<AppSettingRow[]> {
  return db.select().from(appSettings);
}

export function deleteAllAppSettings(): Promise<unknown> {
  return db.delete(appSettings);
}

export type { AppSettingKey, AppSettingRow };