import {
  DarkTheme,
  DefaultTheme,
  type Theme as NavigationTheme,
} from "@react-navigation/native";

import { dark } from "./dark";
import { light } from "./light";

/**
 * React Navigation themes remapped onto the app palette. `DefaultTheme` /
 * `DarkTheme` ship a cold default palette (blue primary, near-black darks),
 * which fought the unistyles tokens and made the navigation frame disagree
 * with the content on every switch. These keep the v7 `fonts` + `dark` flags
 * from the originals but point every color at the Warm Editorial Trust tokens,
 * so the frame (native headers, tab scenes, modals, safe-area band) and the
 * content flip together and always match (see useSettingsBridge).
 */
export const lightNavigationTheme: NavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: light.colors.secondary,
    background: light.colors.background,
    card: light.colors.surfaceElevated,
    text: light.colors.textPrimary,
    border: light.colors.borderSubtle,
    notification: light.colors.critical,
  },
};

export const darkNavigationTheme: NavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: dark.colors.secondary,
    background: dark.colors.background,
    card: dark.colors.surfaceElevated,
    text: dark.colors.textPrimary,
    border: dark.colors.borderSubtle,
    notification: dark.colors.critical,
  },
};