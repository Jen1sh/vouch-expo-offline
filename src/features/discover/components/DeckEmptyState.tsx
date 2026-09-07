import Button from "@/components/Button";
import Text from "@/components/Text";
import View from "@/components/View";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { StyleSheet, useTheme } from "@/src/theme";

type Props = {
  onBrowseAgain: () => void;
  onUndo?: () => void;
};

/**
 * Explicit end-of-deck state (REQUIREMENTS §3.3 acceptance). Reaching it is a
 * first-class moment — no blank card, no loading spinner; the last card can
 * be pulled back with Undo, or the whole deck restarted.
 */
export default function DeckEmptyState({ onBrowseAgain, onUndo }: Props) {
  // useTheme(): pure leaf — raw icon color for the empty-tile glyph.
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.iconTile}>
        <IconSymbol name="rectangle.stack.fill" size={28} color={colors.secondary} />
      </View>
      <Text variant="headlineMd" color="textPrimary" style={styles.title}>
        You are all caught up
      </Text>
      <Text variant="bodyMd" color="textSecondary" style={styles.caption}>
        You have swiped through every introduction in your deck. Undo the last
        card, or shuffle through again.
      </Text>
      <Button variant="primary" onPress={onBrowseAgain}>
        Browse again
      </Button>
      {onUndo ? (
        <Button variant="secondary" onPress={onUndo}>
          Undo last swipe
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.gutterMobile,
  },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    marginBottom: theme.spacing.xs,
  },
  title: {
    textAlign: "center",
  },
  caption: {
    textAlign: "center",
    maxWidth: 320,
  },
}));