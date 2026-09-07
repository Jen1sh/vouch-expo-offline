import { Pressable } from "react-native";
import { router } from "expo-router";

import Button from "@/components/Button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import Text from "@/components/Text";
import View from "@/components/View";
import type { DecisionDirection } from "@/src/db/schema/swipes";
import { StyleSheet, useTheme } from "@/src/theme";

type ProfileActionBarProps = {
  profileId: string;
  firstName: string;
  /** Current decision on this profile (syncs the pressed button state). */
  decision: DecisionDirection | null;
  /** The match thread id when this profile already matched — enables Message. */
  matchId: string | null;
  /** Routes through the single outbox write path (enqueue/undoDecision). */
  onAction: (direction: DecisionDirection) => void;
};

/**
 * The bottom-anchored action bar (REQUIREMENTS §3.5: "same like/skip/ask
 * actions as Discover/Browse"). Reuses the Discover circular-button language:
 * Like (primary), Skip (critical), Ask-your-voucher (amber accent). The
 * pressed direction stays highlighted while it is the current decision, and a
 * matched profile earns a primary Message CTA into its chat thread. Every
 * control has a screen-reader label and ≥44pt touch target.
 */
export function ProfileActionBar({
  profileId,
  firstName,
  decision,
  matchId,
  onAction,
}: ProfileActionBarProps) {
  // useTheme(): raw glyph colors per tone (non-style icon color props).
  const { colors } = useTheme();

  const matchLabel =
    decision === "like" ? `Remove like from ${firstName}` : `Like ${firstName}`;

  return (
    <View style={styles.bar} accessibilityRole="toolbar">
      {matchId ? (
        <Button
          variant="primary"
          onPress={() =>
            router.push({ pathname: "/chat/[matchId]", params: { matchId } })
          }
          accessibilityLabel={`Message ${firstName}`}>
          <IconSymbol name="message.fill" size={18} color={colors.onPrimary} />
          <Text style={styles.messageLabel}>Message</Text>
        </Button>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          decision === "skip" ? `Unskip ${firstName}` : `Skip ${firstName}`
        }
        accessibilityState={{ selected: decision === "skip" }}
        hitSlop={8}
        onPress={() => onAction("skip")}
        style={({ pressed }) =>
          styles.action("skip", decision === "skip", pressed)
        }>
        <IconSymbol
          name="xmark"
          size={26}
          color={decision === "skip" ? colors.onCritical : colors.critical}
        />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ask your voucher to look at ${firstName}`}
        accessibilityState={{ selected: decision === "askVoucher" }}
        hitSlop={8}
        onPress={() => onAction("askVoucher")}
        style={({ pressed }) =>
          styles.action("askVoucher", decision === "askVoucher", pressed)
        }>
        <IconSymbol
          name="arrow.up"
          size={26}
          color={decision === "askVoucher" ? colors.onSecondary : colors.secondary}
        />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={matchLabel}
        accessibilityState={{ selected: decision === "like" }}
        hitSlop={8}
        testID={`profile-like-${profileId}`}
        onPress={() => onAction("like")}
        style={({ pressed }) =>
          styles.action("like", decision === "like", pressed)
        }>
        <IconSymbol
          name={decision === "like" ? "heart.fill" : "heart"}
          size={26}
          color={decision === "like" ? colors.onPrimary : colors.secondary}
        />
      </Pressable>
    </View>
  );
}

type ActionTone = "like" | "skip" | "askVoucher";

const BUTTON_SIZE = 60;

const styles = StyleSheet.create((theme) => ({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.gutterMobile,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.surface,
  },
  action: (tone: ActionTone, active: boolean, pressed: boolean) => {
    const palette = {
      like: {
        background: theme.colors.primary,
        border: theme.colors.primary,
        idle: theme.colors.secondaryContainer,
      },
      skip: {
        background: theme.colors.critical,
        border: theme.colors.critical,
        idle: theme.colors.criticalContainer,
      },
      askVoucher: {
        background: theme.colors.secondary,
        border: theme.colors.secondary,
        idle: theme.colors.secondaryContainer,
      },
    }[tone];

    return {
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      borderRadius: theme.radius.full,
      borderWidth: 1.5,
      borderColor: active ? palette.border : theme.colors.borderSubtle,
      backgroundColor: active || pressed ? palette.background : palette.idle,
      alignItems: "center",
      justifyContent: "center",
      ...(tone === "like" && active && theme.shadows.level1),
    };
  },
  messageLabel: {
    color: theme.colors.onPrimary,
  },
}));