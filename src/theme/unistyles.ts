import { StyleSheet } from "react-native-unistyles";

import { breakpoints } from "./breakpoints";
import { dark } from "./themes/dark";
import { light, type AppTheme } from "./themes/light";

/**
 * Register themes + breakpoints with unistyles before any component renders.
 * Imported for its side effects from `app/_layout.tsx` (and the theme barrel).
 *
 * `adaptiveThemes: false` + `initialTheme: "light"`: unistyles stays on the
 * light theme until the in-app Settings choice is applied by
 * `useSettingsBridge` (which calls `setAdaptiveThemes(true)` for "system" or
 * `setTheme(mode)` otherwise). `initialTheme` is required on web — with more
 * than one registered theme and adaptiveThemes off, web keeps `themeName`
 * undefined and every module-scope `StyleSheet.create` throws at load unless a
 * seed theme is provided.
 */
StyleSheet.configure({
  themes: { light, dark },
  breakpoints,
  settings: {
    adaptiveThemes: false,
    initialTheme: "light",
  },
});

declare module "react-native-unistyles" {
  export interface UnistylesThemes {
    light: AppTheme;
    dark: typeof dark;
  }
  export interface UnistylesBreakpoints {
    mobile: number;
    tablet: number;
    desktop: number;
  }
}

export type { AppTheme };
