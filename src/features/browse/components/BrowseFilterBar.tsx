import { useRef, useState } from "react";
import { Pressable } from "react-native";
import { TrueSheet } from "@lodev09/react-native-true-sheet";

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
 * Compact trigger pill + `@lodev09/react-native-true-sheet` bottom sheet for
 * the Browse filters. TrueSheet gives us a native sheet (grabber, scrim, safe
 * area, keyboard handling) instead of the hand-rolled RN Modal. Opening the
 * sheet keeps the list mounted behind it, so scroll position survives even a
 * mid-scroll filter session; every control inside is `BrowseFilterPanel`,
 * which applies `onChange` live so the FlashList re-queries behind the sheet.
 */
export default function BrowseFilterBar({ filters, onChange, onReset }: BrowseFilterBarProps) {
  // useTheme(): raw tokens passed to the native sheet + icon glyph (non-style props).
  const theme = useTheme();
  const sheetRef = useRef<TrueSheet>(null);
  const [open, setOpen] = useState(false);

  const present = () => {
    void sheetRef.current?.present();
  };
  const dismiss = () => {
    void sheetRef.current?.dismiss();
  };

  const count = activeFilterCount(filters);
  const summary = browseFilterSummary(filters);

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Show filters"
        accessibilityState={{ expanded: open }}
        onPress={present}
        style={({ pressed }) => styles.toggle(pressed)}>
        <IconSymbol name="slider.horizontal.3" size={18} color={theme.colors.textSecondary} />
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

      <TrueSheet
        ref={sheetRef}
        name="browse-filters"
        detents={["auto"]}
        backgroundColor={theme.colors.surfaceElevated}
        cornerRadius={theme.radius.xl}
        grabber
        onDidPresent={() => setOpen(true)}
        onDidDismiss={() => setOpen(false)}>
        <View style={styles.content}>
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
              onPress={dismiss}
              style={({ pressed }) => styles.done(pressed)}>
              <Text variant="labelMd" color="textSecondary">
                Done
              </Text>
            </Pressable>
          </View>
          <BrowseFilterPanel filters={filters} onChange={onChange} onReset={onReset} />
        </View>
      </TrueSheet>
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

const styles = StyleSheet.create((t) => ({
  bar: {
    gap: t.spacing.xs,
  },
  toggle: (pressed: boolean) => ({
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.xs,
    alignSelf: "flex-start",
    maxWidth: "100%",
    borderWidth: 1,
    borderColor: t.colors.borderSubtle,
    borderRadius: t.radius.full,
    backgroundColor: pressed ? t.colors.hoverSurface : t.colors.surface,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing["2xs"],
  }),
  summary: {
    flexShrink: 1,
  },
  count: {
    minWidth: 18,
    height: 18,
    borderRadius: t.radius.full,
    backgroundColor: t.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: t.spacing["2xs"],
  },
  content: {
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.sm,
    paddingBottom: t.spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.xs,
  },
  headerSpacer: {
    flex: 1,
  },
  done: (pressed: boolean) => ({
    borderRadius: t.radius.full,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing["2xs"],
    backgroundColor: pressed ? t.colors.hoverSurface : "transparent",
  }),
}));