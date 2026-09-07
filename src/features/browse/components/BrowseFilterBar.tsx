import { useState } from "react";
import { Modal, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "@/components/Text";
import View from "@/components/View";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrowseFilterPanel } from "@/src/features/browse/components/BrowseFilterPanel";
import {
  activeFilterCount,
  ageRangeLabel,
  type BrowseFilters,
  distanceLabel,
} from "@/src/features/browse/model/browseFilters";
import { StyleSheet, useTheme } from "@/src/theme";

type BrowseFilterBarProps = {
  filters: BrowseFilters;
  onChange: (filters: BrowseFilters) => void;
  onReset: () => void;
};

/**
 * Compact trigger pill + bottom-sheet modal for the Browse filters. Opening the
 * sheet keeps the list mounted behind it, so scroll position survives even a
 * mid-scroll filter session; every control inside is `BrowseFilterPanel`,
 * which applies `onChange` live so the FlashList re-queries behind the sheet.
 */
export default function BrowseFilterBar({ filters, onChange, onReset }: BrowseFilterBarProps) {
  // useTheme(): raw glyph colors for the trigger icon (non-style props).
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);
  const count = activeFilterCount(filters);
  const summary = browseFilterSummary(filters);

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Show filters"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => styles.toggle(pressed)}>
        <IconSymbol name="slider.horizontal.3" size={18} color={colors.textSecondary} />
        <Text variant="labelLg" color="textPrimary">
          Filters
        </Text>
        {summary ? (
          <Text variant="labelMd" color="textMuted" numberOfLines={1} style={styles.summary}>
            {summary}
          </Text>
        ) : null}
        {count > 0 ? (
          <View style={styles.count}>
            <Text variant="labelCaps" color="onSecondary">
              {count}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={close}>
        <View style={styles.overlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close filters"
            style={styles.scrim}
            onPress={close}
          />
          <View style={[styles.sheet, styles.sheetInsets(insets.bottom)]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text variant="headlineSm" color="textPrimary">
                Filters
              </Text>
              {count > 0 ? (
                <View style={styles.count}>
                  <Text variant="labelCaps" color="onSecondary">
                    {count}
                  </Text>
                </View>
              ) : null}
              <View style={styles.headerSpacer} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Done"
                hitSlop={8}
                onPress={close}
                style={({ pressed }) => styles.done(pressed)}>
                <Text variant="labelMd" color="textSecondary">
                  Done
                </Text>
              </Pressable>
            </View>
            <BrowseFilterPanel filters={filters} onChange={onChange} onReset={onReset} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function browseFilterSummary(filters: BrowseFilters): string | null {
  const parts: string[] = [];
  if (filters.ageFrom !== null || filters.ageTo !== null) {
    parts.push(ageRangeLabel(filters));
  }
  if (filters.maxDistanceKm !== null) {
    parts.push(distanceLabel(filters.maxDistanceKm));
  }
  if (filters.verifiedOnly) {
    parts.push("Verif.");
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

const styles = StyleSheet.create((theme) => ({
  bar: {
    gap: theme.spacing.xs,
  },
  toggle: (pressed: boolean) => ({
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    alignSelf: "flex-start",
    maxWidth: "100%",
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radius.full,
    backgroundColor: pressed ? theme.colors.hoverSurface : theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing["2xs"],
  }),
  summary: {
    flexShrink: 1,
  },
  count: {
    minWidth: 18,
    height: 18,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing["2xs"],
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.scrim,
  },
  sheet: {
    gap: theme.spacing.md,
    maxHeight: "86%",
    backgroundColor: theme.colors.surfaceElevated,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  sheetInsets: (insetBottom: number) => ({
    paddingBottom: Math.max(insetBottom, theme.spacing.lg),
  }),
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.borderStrong,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  headerSpacer: {
    flex: 1,
  },
  done: (pressed: boolean) => ({
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing["2xs"],
    backgroundColor: pressed ? theme.colors.hoverSurface : "transparent",
  }),
}));