import { IconSymbol } from "@/components/ui/icon-symbol";
import Text from "@/components/Text";
import View from "@/components/View";
import { StyleSheet, useTheme } from "@/src/theme";

type ProfileBodyProps = {
  bio: string;
  verified: boolean;
  interests: string[];
};

/**
 * The editorial content block (REQUIREMENTS §3.5, DESIGN.md "Introduction &
 * Profile Cards"): the long-form bio is set in italic body type to read like a
 * peer endorsement, verified gets a quiet emerald pill, and interest tags use
 * the same full-pill treatment as the Discover card.
 */
export function ProfileBody({ bio, verified, interests }: ProfileBodyProps) {
  // useTheme(): raw `verifiedText`/`iconDefault` for the pill's non-style props.
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text variant="bodyLg" color="textSecondary" style={styles.bio}>
        {bio}
      </Text>

      {verified ? (
        <View style={styles.verifiedPill}>
          <IconSymbol name="checkmark.seal.fill" size={14} color={colors.verifiedText} />
          <Text variant="labelMd" color="verifiedText">
            Verified
          </Text>
        </View>
      ) : null}

      {interests.length > 0 ? (
        <View style={styles.chips}>
          {interests.map((interest) => (
            <View key={interest} style={styles.chip}>
              <Text variant="labelMd" color="textSecondary">
                {interest}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: {
    paddingHorizontal: theme.spacing.gutterMobile,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  bio: {
    fontStyle: "italic",
    lineHeight: 26,
  },
  verifiedPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing["2xs"],
    backgroundColor: theme.colors.verifiedBackground,
    borderWidth: 1,
    borderColor: theme.colors.verifiedBorder,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing["2xs"],
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  chip: {
    backgroundColor: theme.colors.surfaceSubdued,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing["2xs"],
  },
}));