import { Pressable } from "react-native";

import Text from "@/components/Text";
import View from "@/components/View";
import { StyleSheet } from "@/src/theme";

type BrowseEmptyStateProps = {
  onReset: () => void;
};

/** Shown when the filtered catalog returns zero rows. */
export default function BrowseEmptyState({ onReset }: BrowseEmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Text variant="headlineSm" color="textPrimary">
        No matches yet
      </Text>
      <Text variant="bodyMd" color="textSecondary" style={styles.caption}>
        Nothing in your area fits these filters. Loosen them and browse again.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reset all filters"
        onPress={onReset}
        style={styles.reset}>
        <Text variant="labelMd" color="onSecondary">
          Reset all filters
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: {
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing["3xl"],
    paddingHorizontal: theme.spacing.xl,
  },
  caption: {
    textAlign: "center",
  },
  reset: {
    marginTop: theme.spacing.xs,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
}));