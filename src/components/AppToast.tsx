import { Pressable } from "react-native";
import Toast, { type ToastConfigParams } from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "@/components/Text";
import View from "@/components/View";
import { IconSymbol, type IconSymbolName } from "@/components/ui/icon-symbol";
import { StyleSheet, useTheme } from "@/src/theme";

/**
 * The one Toast instance for the whole app (react-native-toast-message),
 * configured with a single themed skin so every notification — "Shortlisted",
 * "Theme updated", "Note saved", … — matches the Warm Editorial Trust system.
 * Renderers read only the plain `text1`/`text2` fields; the type drives the
 * accent color + glyph. `showAppToast` is the only place the app should call
 * `Toast.show`.
 */

export type AppToastType = "success" | "error" | "info";

const GLYPH: Record<AppToastType, IconSymbolName> = {
  success: "checkmark",
  error: "xmark",
  info: "checkmark.seal.fill",
};

const ACCENT: Record<AppToastType, "tertiary" | "critical" | "secondary"> = {
  success: "tertiary",
  error: "critical",
  info: "secondary",
};

const ICON_TEXT: Record<AppToastType, "onTertiary" | "onCritical" | "onSecondary"> = {
  success: "onTertiary",
  error: "onCritical",
  info: "onSecondary",
};

function ThemeToast({
  text1,
  text2,
  type,
}: {
  text1?: string;
  text2?: string;
  type: AppToastType;
}) {
  // useTheme(): raw glyph + accent colors for non-style props (pure leaf).
  const { colors } = useTheme();
  return (
    <Pressable
      testID="app-toast"
      accessibilityRole="alert"
      accessibilityLabel={text1 || text2}
      onPress={() => Toast.hide()}
      style={({ pressed }) => styles.toast(pressed)}>
      <View style={[styles.glyphWrap, { backgroundColor: colors[ACCENT[type]] }]}>
        <IconSymbol name={GLYPH[type]} size={16} color={colors[ICON_TEXT[type]]} />
      </View>
      <View style={styles.copy}>
        {text1 ? (
          <Text variant="labelLg" color="textPrimary">
            {text1}
          </Text>
        ) : null}
        {text2 ? (
          <Text variant="bodySm" color="textSecondary">
            {text2}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function AppToast() {
  const insets = useSafeAreaInsets();
  const render = (params: ToastConfigParams<unknown>) => (
    <ThemeToast text1={params.text1} text2={params.text2} type={params.type as AppToastType} />
  );
  return (
    <Toast
      position="top"
      topOffset={insets.top + 8}
      visibilityTime={2000}
      config={{ success: render, error: render, info: render }}
    />
  );
}

export function showAppToast(type: AppToastType, text1: string, text2?: string): void {
  Toast.show({ type, text1, text2 });
}

const styles = StyleSheet.create((theme) => ({
  toast: (pressed: boolean) => ({
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    backgroundColor: pressed ? theme.colors.hoverSurface : theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    ...theme.shadows.level2,
  }),
  glyphWrap: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    gap: theme.spacing["2xs"],
  },
}));