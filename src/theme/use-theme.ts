import { UnistylesRuntime, useUnistyles } from 'react-native-unistyles';

/**
 * Read the active theme object inside a component. Per CONVENTIONS §6.2 this
 * is only for passing a raw token to a non-style prop (icon `color`,
 * native-module arg) on a small pure leaf — use the themed
 * `StyleSheet.create(theme => ...)` pattern everywhere else.
 */
export function useTheme() {
  const { theme } = useUnistyles();
  return theme;
}

export function useColorMode() {
  const current = UnistylesRuntime.themeName;
  const colorScheme = UnistylesRuntime.colorScheme;
  const setTheme = (mode: 'light' | 'dark') => UnistylesRuntime.setTheme(mode);
  const followSystem = () => UnistylesRuntime.setAdaptiveThemes(true);
  return { current, colorScheme, setTheme, followSystem };
}

export function getTheme() {
  return UnistylesRuntime.getTheme();
}