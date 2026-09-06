import { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { StyleSheet as ThemeStyleSheet, type AppTheme, type SpacingToken } from '@/src/theme';

import Text from '@/components/Text';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export default function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  children,
  style,
  ...rest
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => styles.button(variant, size, pressed, disabled === true, style)}
      {...rest}>
      {typeof children === 'string' ? (
        <Text style={styles.label(variant)}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = ThemeStyleSheet.create((theme) => {
  const background: Record<ButtonVariant, keyof AppTheme['colors']> = {
    primary: 'primary',
    secondary: 'surfaceElevated',
    destructive: 'criticalContainer',
  };
  const pressedBackground: Record<ButtonVariant, keyof AppTheme['colors']> = {
    primary: 'primaryContainer',
    secondary: 'hoverSurface',
    destructive: 'destructiveHover',
  };
  const labelColor: Record<ButtonVariant, keyof AppTheme['colors']> = {
    primary: 'onPrimary',
    secondary: 'textPrimary',
    destructive: 'critical',
  };
  const padding: Record<ButtonSize, { vertical: SpacingToken | 14; horizontal: SpacingToken }> = {
    sm: { vertical: '2xs', horizontal: 'md' },
    md: { vertical: 14, horizontal: 'lg' },
    lg: { vertical: 'md', horizontal: 'xl' },
  };

  return {
    button: (
      variant: ButtonVariant,
      size: ButtonSize,
      pressed: boolean,
      disabled: boolean,
      external?: StyleProp<ViewStyle>
    ) => {
      const sizePadding = padding[size];
      return {
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: theme.spacing.xs,
        borderRadius: theme.radius.md,
        paddingVertical:
          typeof sizePadding.vertical === 'number'
            ? sizePadding.vertical
            : theme.spacing[sizePadding.vertical],
        paddingHorizontal: theme.spacing[sizePadding.horizontal],
        borderWidth: variant === 'secondary' ? 1.5 : 0,
        borderColor: theme.colors.borderStrong,
        backgroundColor: theme.colors[
          pressed ? pressedBackground[variant] : background[variant]
        ],
        ...(disabled && { opacity: 0.5 }),
        ...(StyleSheet.flatten(external) as object),
      };
    },
    label: (variant: ButtonVariant) => ({
      ...theme.typography.labelLg,
      color: theme.colors[labelColor[variant]],
    }),
  };
});