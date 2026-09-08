import { useSyncExternalStore } from "react";

import type {
  LanguageSetting,
  SettingsSnapshot,
  ThemeModeSetting,
} from "@/src/db/queries/settings.queries";

/**
 * Reactive in-memory mirror of the durable `app_settings` rows (REQUIREMENTS
 * §3.8). Like `user-swipes`, SQLite stays the source of truth — this narrow
 * channel just lets the Settings screen (and the root layout's theme/language
 * bridges) subscribe to changes synchronously. It is hydrated from
 * `getSettingsSnapshot()` once at startup and patched on each write; the only
 * writers are `src/features/settings/writes.ts`, which persist to the DB first.
 */

const DEFAULTS: SettingsSnapshot = {
  themeMode: "system",
  language: "en",
  notificationsEnabled: false,
};

let state: SettingsSnapshot = { ...DEFAULTS };
const listeners = new Set<() => void>();

export function getSettings(): SettingsSnapshot {
  return state;
}

function notify(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Replaces the whole snapshot and notifies only when something actually changed. */
export function hydrateSettings(next: SettingsSnapshot): void {
  if (
    next.themeMode === state.themeMode &&
    next.language === state.language &&
    next.notificationsEnabled === state.notificationsEnabled
  ) {
    return;
  }
  state = { ...next };
  notify();
}

export function patchSettings(patch: Partial<SettingsSnapshot>): void {
  const next = { ...state, ...patch };
  if (
    next.themeMode === state.themeMode &&
    next.language === state.language &&
    next.notificationsEnabled === state.notificationsEnabled
  ) {
    return;
  }
  state = next;
  notify();
}

/** For tests / wipe: reset to built-in defaults without writing to the DB. */
export function resetSettingsState(): void {
  patchSettings({ ...DEFAULTS });
}

export function useSettings(): SettingsSnapshot {
  return useSyncExternalStore(
    subscribe,
    getSettings,
    getSettings
  );
}

export type { LanguageSetting, SettingsSnapshot, ThemeModeSetting };