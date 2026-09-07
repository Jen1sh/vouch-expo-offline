import { Pressable, Switch } from "react-native";

import Text from "@/components/Text";
import View from "@/components/View";
import {
  activeFilterCount,
  type BrowseFilters,
  DISTANCE_LIMITS,
  nudgeAgeFrom,
  nudgeAgeTo,
  setMaxDistanceKm,
  setVerifiedOnly,
} from "@/src/features/browse/model/browseFilters";
import { StyleSheet, useTheme } from "@/src/theme";

type BrowseFilterPanelProps = {
  filters: BrowseFilters;
  onChange: (filters: BrowseFilters) => void;
  onReset: () => void;
};

/**
 * The filter controls body rendered inside the bottom sheet (and reused by the
 * sheet's tests): age range steppers, distance chips, verified-only switch,
 * and a reset action. Pure — every interaction folds back through the
 * `model/browseFilters` transitions onto `onChange`, so the visible labels and
 * the SQL WHERE stay in sync.
 */
export function BrowseFilterPanel({ filters, onChange, onReset }: BrowseFilterPanelProps) {
  // useTheme(): raw track/thumb colors for the RN Switch (non-style props).
  const { colors } = useTheme();
  const count = activeFilterCount(filters);

  return (
    <View style={styles.panel}>
      <Text variant="labelCaps" color="textMuted">
        Age range
      </Text>
      <View style={styles.stepperRow}>
        <Stepper
          label="From"
          value={filters.ageFrom}
          onDelta={(delta) => onChange(nudgeAgeFrom(filters, delta))}
        />
        <Stepper
          label="To"
          value={filters.ageTo}
          onDelta={(delta) => onChange(nudgeAgeTo(filters, delta))}
        />
      </View>

      <Text variant="labelCaps" color="textMuted">
        Distance
      </Text>
      <View style={styles.chips} accessibilityRole="toolbar">
        {[null, ...DISTANCE_LIMITS].map((limitKm) => {
          const selected = filters.maxDistanceKm === limitKm;
          return (
            <Pressable
              key={limitKm === null ? "any" : String(limitKm)}
              accessibilityRole="button"
              accessibilityLabel={limitKm === null ? "Any distance" : `Within ${limitKm} kilometres`}
              accessibilityState={{ selected }}
              onPress={() => onChange(setMaxDistanceKm(filters, limitKm))}
              style={({ pressed }) => styles.chip(selected, pressed)}>
              <Text variant="labelMd" color={selected ? "onSecondary" : "textPrimary"}>
                {limitKm === null ? "Any" : `≤${limitKm}km`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text variant="labelMd" color="textPrimary">
            Verified members only
          </Text>
          <Text variant="bodySm" color="textMuted">
            Badge shown on their card
          </Text>
        </View>
        <Switch
          accessibilityLabel="Verified members only"
          value={filters.verifiedOnly}
          onValueChange={(value) => onChange(setVerifiedOnly(filters, value))}
          trackColor={{ false: colors.borderStrong, true: colors.secondary }}
          thumbColor={colors.surfaceElevated}
        />
      </View>

      {count > 0 ? (
        <View style={styles.resetRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset all filters"
            onPress={onReset}
            style={({ pressed }) => styles.reset(pressed)}>
            <Text variant="labelMd" color="textMuted">
              Reset all filters
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Stepper({
  label,
  value,
  onDelta,
}: {
  label: string;
  value: number | null;
  onDelta: (delta: -1 | 1) => void;
}) {
  const display = value === null ? "Any" : String(value);
  return (
    <View style={styles.stepper}>
      <Text variant="labelCaps" color="textMuted">
        {label}
      </Text>
      <View style={styles.stepperControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label.toLowerCase()} age`}
          hitSlop={6}
          onPress={() => onDelta(-1)}
          style={({ pressed }) => styles.stepButton(pressed)}>
          <Text variant="titleMd" color="textPrimary">
            {"\u2212"}
          </Text>
        </Pressable>
        <Text variant="titleMd" color="textPrimary" style={styles.stepValue}>
          {display}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label.toLowerCase()} age`}
          hitSlop={6}
          onPress={() => onDelta(1)}
          style={({ pressed }) => styles.stepButton(pressed)}>
          <Text variant="titleMd" color="textPrimary">
            {"+"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  panel: {
    gap: theme.spacing.sm,
  },
  stepperRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  stepper: {
    flex: 1,
    gap: theme.spacing["2xs"],
  },
  stepperControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepButton: (pressed: boolean) => ({
    width: 36,
    height: 36,
    borderRadius: theme.radius.default,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: pressed ? theme.colors.hoverSurface : theme.colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  }),
  stepValue: {
    minWidth: 40,
    textAlign: "center",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  chip: (selected: boolean, pressed: boolean) => ({
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: selected ? theme.colors.secondary : theme.colors.borderStrong,
    backgroundColor: selected
      ? theme.colors.secondary
      : pressed
        ? theme.colors.hoverSurface
        : theme.colors.surfaceElevated,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  }),
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  switchText: {
    flex: 1,
    gap: theme.spacing["2xs"],
  },
  resetRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: theme.spacing.sm,
  },
  reset: (pressed: boolean) => ({
    alignSelf: "flex-start",
    paddingVertical: theme.spacing["2xs"],
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.sm,
    backgroundColor: pressed ? theme.colors.hoverSurface : "transparent",
  }),
}));