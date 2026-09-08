import { act, renderHook } from "@testing-library/react-native";
import { beforeEach, describe, expect, it } from "@jest/globals";

import {
  getSettings,
  hydrateSettings,
  patchSettings,
  resetSettingsState,
  useSettings,
} from "@/src/features/settings/store/settings";

describe("settings store mirror (REQUIREMENTS §3.8)", () => {
  beforeEach(() => {
    resetSettingsState();
  });

  it("defaults to system theme, English and notifications off", () => {
    expect(getSettings()).toEqual({
      themeMode: "system",
      language: "en",
      notificationsEnabled: false,
    });
  });

  it("hydrateSettings replaces the snapshot and notifies subscribers once", () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.themeMode).toBe("system");

    act(() => {
      hydrateSettings({ themeMode: "dark", language: "ar", notificationsEnabled: true });
    });

    expect(result.current).toEqual({
      themeMode: "dark",
      language: "ar",
      notificationsEnabled: true,
    });
  });

  it("patchSettings merges partial writes without notifying on no-ops", () => {
    const { result } = renderHook(() => useSettings());
    act(() => {
      patchSettings({ themeMode: "light" });
    });
    expect(result.current.themeMode).toBe("light");
    // language/notifications keep their previous values.
    expect(result.current.language).toBe("en");
    expect(result.current.notificationsEnabled).toBe(false);

    // A no-op patch still leaves the snapshot alone and doesn't re-render.
    const snapshot = result.current;
    act(() => {
      patchSettings({ themeMode: "light" });
    });
    expect(result.current).toBe(snapshot);
  });

  it("resetSettingsState returns to defaults (wipe path)", () => {
    act(() => {
      hydrateSettings({ themeMode: "dark", language: "ar", notificationsEnabled: true });
      resetSettingsState();
    });
    expect(getSettings()).toEqual({
      themeMode: "system",
      language: "en",
      notificationsEnabled: false,
    });
  });
});