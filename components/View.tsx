import {
  StyleSheet,
  View as NativeView,
  type StyleProp,
  type ViewProps as NativeViewProps,
  type ViewStyle,
} from 'react-native';

import { StyleSheet as ThemeStyleSheet, type AppTheme } from '@/src/theme';

export type ViewVariant = 'background' | 'surface' | 'surfaceSubdued' | 'surfaceElevated';

export type ViewProps = NativeViewProps & {
  variant?: ViewVariant;
};

export default function View({ style, variant = 'background', ...rest }: ViewProps) {
  return <NativeView style={styles.view(variant, style)} {...rest} />;
}

const styles = ThemeStyleSheet.create((theme) => ({
  view: (variant: ViewVariant, external?: StyleProp<ViewStyle>) => ({
    backgroundColor: theme.colors[backgroundFor(variant)],
    ...(StyleSheet.flatten(external) as object),
  }),
}));

function backgroundFor(variant: ViewVariant): keyof AppTheme['colors'] {
  switch (variant) {
    case 'surface':
      return 'surface';
    case 'surfaceSubdued':
      return 'surfaceSubdued';
    case 'surfaceElevated':
      return 'surfaceElevated';
    default:
      return 'background';
  }
}