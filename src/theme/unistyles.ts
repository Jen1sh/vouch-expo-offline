import { StyleSheet } from 'react-native-unistyles';

import { breakpoints } from './breakpoints';
import { light, type AppTheme } from './themes/light';
import { dark } from './themes/dark';

/**
 * Register themes + breakpoints with unistyles before any component renders.
 * Imported for its side effects from `app/_layout.tsx` (and the theme barrel).
 *
 * `adaptiveThemes: true` makes unistyles follow the OS color scheme so the
 * active theme flips light/dark automatically. Manual override for the
 * in-app Settings toggle goes through `UnistylesRuntime.setTheme`.
 */
StyleSheet.configure({
  themes: { light, dark },
  breakpoints,
  settings: {
    adaptiveThemes: true,
  },
});

declare module 'react-native-unistyles' {
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