import {
  StyleSheet,
  Text as NativeText,
  type StyleProp,
  type TextStyle,
  type TextProps as NativeTextProps,
} from 'react-native';

import { StyleSheet as ThemeStyleSheet, type AppTheme, type TypographyToken } from '@/src/theme';

export type TextProps = NativeTextProps & {
  variant?: TypographyToken;
  color?: keyof AppTheme['colors'];
};

export default function Text({
  style,
  variant = 'bodyMd',
  color = 'textPrimary',
  ...rest
}: TextProps) {
  return <NativeText style={styles.text(variant, color, style)} {...rest} />;
}

const styles = ThemeStyleSheet.create((theme) => ({
  text: (variant: TypographyToken, color: keyof AppTheme['colors'], external?: StyleProp<TextStyle>) => ({
    ...theme.typography[variant],
    color: theme.colors[color],
    ...(StyleSheet.flatten(external) as object),
  }),
}));