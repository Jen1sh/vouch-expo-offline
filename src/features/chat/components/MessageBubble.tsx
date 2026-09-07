import { Pressable } from "react-native";

import Text from "@/components/Text";
import View from "@/components/View";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SELF_SENDER_ID } from "@/src/features/chat/constants";
import { useMessageStatus } from "@/src/features/chat/store/message-status";
import type { ThreadMessage } from "@/src/features/chat/model/thread";
import { StyleSheet, useTheme } from "@/src/theme";

type MessageBubbleProps = {
  message: ThreadMessage;
  /** Partner display name for accessibility labels on incoming bubbles. */
  senderName?: string;
  onRetry?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
};

/**
 * One chat bubble (REQUIREMENTS §3.6). Outgoing messages live on the right and
 * render their transport state — `queued`/`sending` → "Sending…", `sent` → a
 * check, `failed` → "Not delivered" with Retry/Delete actions — driven by the
 * per-message status mirror (`useMessageStatus`) so any bubble can re-render
 * alone when the drain flips its state. Incoming messages are static.
 */
export function MessageBubble({ message, senderName, onRetry, onDelete }: MessageBubbleProps) {
  const { colors } = useTheme();
  const mirrored = useMessageStatus(message.id);
  const status = mirrored ?? message.status;
  const mine = message.senderId === SELF_SENDER_ID;

  const label = mine
    ? `You, ${status}`
    : `${senderName ?? "Partner"}, ${message.body}`;

  return (
    <View style={styles.row(mine)}>
      <View
        style={styles.bubble(mine, status)}
        accessibilityLabel={label}
        testID={`message-bubble-${message.id}`}>
        <Text
          variant="bodyMd"
          color={mine ? "onPrimaryContainer" : "textPrimary"}
          style={styles.body}>
          {message.body}
        </Text>
      </View>

      {mine && status === "sent" ? (
        <View style={styles.footer}>
          <IconSymbol name="checkmark" size={12} color={colors.tertiary} />
          <Text variant="bodySm" color="textMuted">
            Sent
          </Text>
        </View>
      ) : null}

      {mine && (status === "queued" || status === "sending") ? (
        <View style={styles.footer}>
          <Text variant="bodySm" color="textMuted">
            Sending…
          </Text>
        </View>
      ) : null}

      {mine && status === "failed" ? (
        <View style={styles.failedFooter}>
          <Text variant="bodySm" color="critical">
            Not delivered
          </Text>
          <View style={styles.actions}>
            {onRetry ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Retry message ${message.id}`}
                hitSlop={8}
                onPress={() => onRetry(message.id)}
                style={({ pressed }) => styles.actionButton(pressed)}>
                <Text variant="labelMd" color="textPrimary">
                  Retry
                </Text>
              </Pressable>
            ) : null}
            {onDelete ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete message ${message.id}`}
                hitSlop={8}
                onPress={() => onDelete(message.id)}
                style={({ pressed }) => styles.actionButton(pressed)}>
                <Text variant="labelMd" color="critical">
                  Delete
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default MessageBubble;

const styles = StyleSheet.create((theme) => ({
  row: (mine: boolean) => ({
    alignItems: mine ? "flex-end" : "flex-start",
    gap: theme.spacing['2xs'],
  }),
  bubble: (mine: boolean, status: ThreadMessage["status"]) => ({
    maxWidth: "78%",
    borderRadius: theme.radius.lg,
    borderTopLeftRadius: mine ? theme.radius.lg : theme.radius.sm,
    borderTopRightRadius: mine ? theme.radius.sm : theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: mine
      ? status === "failed"
        ? theme.colors.criticalContainer
        : theme.colors.primaryContainer
      : theme.colors.surfaceElevated,
    borderWidth: mine ? 0 : 1,
    borderColor: theme.colors.borderSubtle,
  }),
  body: {
    flexShrink: 1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing['2xs'],
    paddingHorizontal: theme.spacing['2xs'],
    paddingTop: theme.spacing['2xs'],
  },
  failedFooter: {
    gap: theme.spacing['2xs'],
    paddingHorizontal: theme.spacing['2xs'],
    paddingTop: theme.spacing['2xs'],
    alignItems: "flex-end",
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  actionButton: (pressed: boolean) => ({
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing['2xs'],
    borderRadius: theme.radius.md,
    backgroundColor: pressed ? theme.colors.hoverSurface : theme.colors.surfaceSubdued,
  }),
}));