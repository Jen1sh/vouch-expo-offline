import { db } from "@/src/db/client";
import { ensureMigrated } from "@/src/db/migrate";
import { upsertAppSetting } from "@/src/db/queries/settings.queries";
import type {
  LanguageSetting,
  ThemeModeSetting,
} from "@/src/db/queries/settings.queries";
import { patchSettings } from "@/src/features/settings/store/settings";

/**
 * Durably changes one preference (REQUIREMENTS §3.8). Each setter waits for
 * the migrations, writes the key to `app_settings`, and only then reflects
 * the value into the reactive settings store — the root layout's bridges
 * (theme runtime, I18nManager, RTL reload) subscribe to that store and apply
 * the visual side effects. The UI never reads its own write back: it flips
 * instantly through the store and the DB stays the durable source of truth.
 */

async function persistSetting(key: "themeMode" | "language" | "notificationsEnabled", value: string): Promise<void> {
  await ensureMigrated();
  const now = new Date();
  await db.transaction(async (tx) => {
    await upsertAppSetting(tx, key, value, now);
  });
}

export async function setThemeMode(mode: ThemeModeSetting): Promise<void> {
  await persistSetting("themeMode", mode);
  patchSettings({ themeMode: mode });
}

export async function setLanguage(language: LanguageSetting): Promise<void> {
  await persistSetting("language", language);
  patchSettings({ language });
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await persistSetting("notificationsEnabled", String(enabled));
  patchSettings({ notificationsEnabled: enabled });
}