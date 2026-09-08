import { useEffect, useLayoutEffect } from "react";
import { I18nManager, Platform } from "react-native";

import { ensureMigrated } from "@/src/db/migrate";
import { getSettingsSnapshot } from "@/src/db/queries/settings.queries";
import {
  hydrateSettings,
  useSettings,
} from "@/src/features/settings/store/settings";
import { UnistylesRuntime } from "@/src/theme";

/**
 * Bridges the persisted preferences (REQUIREMENTS §3.8) into the runtimes
 * that render the app. Runs once per process at the root layout:
 * - on mount it hydrates the in-memory settings store from `app_settings`;
 * - when `themeMode` moves, it drives `UnistylesRuntime` (fixed light/dark or
 *   back to adaptive "follow system");
 * - when `language` moves, it re-arms `I18nManager` for the chosen direction
 *   (RTL for Arabic). The companion navigator remount on language (the
 *   `key={language}` on the root Stack) forces the layout to reflow.
 */
export function useSettingsBridge(): void {
  const { themeMode, language } = useSettings();

  useEffect(() => {
    let active = true;
    ensureMigrated()
      .then(getSettingsSnapshot)
      .then((snapshot) => {
        if (active) {
          hydrateSettings(snapshot);
        }
      })
      .catch((error) => {
        console.warn("[settings] failed to hydrate preferences", error);
      });
    return () => {
      active = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (themeMode === "system") {
      UnistylesRuntime.setAdaptiveThemes(true);
      return;
    }
    UnistylesRuntime.setAdaptiveThemes(false);
    UnistylesRuntime.setTheme(themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (Platform.OS === "ios" || Platform.OS === "android") {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(language === "ar");
    }
  }, [language]);
}