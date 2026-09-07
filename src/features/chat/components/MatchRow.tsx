import { memo } from "react";
import { Pressable } from "react-native";
import { Image } from "expo-image";

import Text from "@/components/Text";
import View from "@/components/View";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { MatchListItem } from "@/src/db/queries/matches.queries";
import { StyleSheet, useTheme } from "@/src/theme";

type MatchRowProps = {
  match: MatchListItem;
  onPress: (matchId: string) => void;
};

/**
 * One matches-list row (REQUIREMENTS §3.6): partner avatar + name, the newest
 * message preview (own messages prefixed "You:") with a transport caption for
 * a not-yet-sent preview, a relative timestamp, and the unread pill.
 */
const MatchRow = memo(function MatchRow({ match, onPress }: MatchRowProps) {
  const { colors } = useTheme();

  const name = `${match.firstName} ${match.lastName}`;
  const preview = formatPreview(match);
  const caption = match.lastMessageStatus && match.lastMessageStatus !== "sent"
    ? statusCaption(match.lastMessageStatus)
    : match.lastMessageAt != null
      ? formatRelativeTime(match.lastMessageAt)
      : "Say hello";

  return (
    <Pressable
      testID={`match-row-${match.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${match.firstName}, ${preview}`}
      onPress={() => onPress(match.id)}
      style={({ pressed }) => styles.row(pressed)}>
      <View variant="surfaceSubdued" style={styles.avatarWrap}>
        <Image
          source={{ uri: match.photoUri }}
          style={styles.avatar}
          contentFit="cover"
          transition={80}
          cachePolicy="memory-disk"
          recyclingKey={match.profileId}
          accessibilityLabel={`Photo of ${match.firstName}`}
        />
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text variant="titleMd" color="textPrimary" numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          {match.verified ? (
            <IconSymbol name="checkmark.seal.fill" size={14} color={colors.tertiary} />
          ) : null}
          <Text variant="bodySm" color="textMuted" numberOfLines={1} style={styles.timestamp}>
            {caption}
          </Text>
        </View>
        <Text
          variant="bodySm"
          color={match.unreadCount > 0 ? "textPrimary" : "textSecondary"}
          numberOfLines={2}
          style={styles.preview}>
          {preview}
        </Text>
      </View>

      {match.unreadCount > 0 ? (
        <View style={styles.unreadPill} accessibilityLabel={`${match.unreadCount} unread`}>
          <Text variant="labelMd" color="onSecondary">
            {match.unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

function formatPreview(match: MatchListItem): string {
  if (!match.lastMessageBody) {
    return "No messages yet.";
  }
  const prefix =
    match.lastMessageSenderId === "me"
      ? "You: "
      : match.lastMessageStatus === "queued" || match.lastMessageStatus === "sending" || match.lastMessageStatus === "failed"
        ? "You: "
        : "";
  return `${prefix}${match.lastMessageBody}`;
}

function statusCaption(status: MatchListItem["lastMessageStatus"]): string {
  switch (status) {
    case "queued":
      return "queued";
    case "sending":
      return "sending…";
    case "failed":
      return "failed — retry";
    default:
      return "sent";
  }
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) {
    return "now";
  }
  if (mins < 60) {
    return `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default MatchRow;

const styles = StyleSheet.create((theme) => ({
  row: (pressed: boolean) => ({
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: pressed ? theme.colors.hoverSurface : theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
  }),
  avatarWrap: {
    borderRadius: theme.radius.full,
    overflow: "hidden",
  },
  avatar: {
    width: 52,
    height: 52,
  },
  info: {
    flex: 1,
    gap: theme.spacing["2xs"],
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing["2xs"],
  },
  name: {
    flexShrink: 1,
  },
  timestamp: {
    marginLeft: "auto",
    paddingLeft: theme.spacing.xs,
  },
  preview: {
    flexShrink: 1,
  },
  unreadPill: {
    minWidth: 22,
    height: 22,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing['2xs'],
    backgroundColor: theme.colors.secondary,
  },
}));