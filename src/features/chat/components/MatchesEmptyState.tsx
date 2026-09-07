import Text from "@/components/Text";
import View from "@/components/View";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { StyleSheet, useTheme } from "@/src/theme";

/** Empty state when the member has no matches yet ("new match" CTA). */
export function MatchesEmptyState() {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <IconSymbol name="heart" size={28} color={colors.iconDefault} />
      </View>
      <Text variant="titleMd" color="textPrimary" style={styles.title}>
        No matches yet
      </Text>
      <Text variant="bodyMd" color="textSecondary" style={styles.caption}>
        Like someone in Discover — when they like you back, the conversation
        starts here.
      </Text>
    </View>
  );
}

export default MatchesEmptyState;

const styles = StyleSheet.create((theme) => ({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing['3xl'],
    gap: theme.spacing.sm,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceSubdued,
  },
  title: {
    textAlign: "center",
  },
  caption: {
    textAlign: "center",
  },
}));