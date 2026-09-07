import { useCallback, useEffect, useRef } from "react";
import { ActivityIndicator } from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";

import Text from "@/components/Text";
import View from "@/components/View";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { deleteMessage, retryFailedMessage, sendMessage } from "@/src/outbox";
import { MessageBubble } from "@/src/features/chat/components/MessageBubble";
import { MessageComposer } from "@/src/features/chat/components/MessageComposer";
import { useThread } from "@/src/features/chat/hooks/useThread";
import type { ThreadMessage } from "@/src/features/chat/model/thread";
import { refreshMatches } from "@/src/features/chat/store/matches";
import { noteThreadChanged } from "@/src/features/chat/store/thread-revision";
import { getModeSnapshot } from "@/src/store/mode/mode-snapshot";
import { StyleSheet, useTheme } from "@/src/theme";

/**
 * The 1:1 thread (REQUIREMENTS §3.6). Data is newest-first and the FlashList
 * renders vertically flipped via `scaleY(-1)` (FlashList v2 dropped its
 * `inverted` prop), so index 0 is the visual bottom: new arrivals merge to the
 * front, scrolling up triggers keyset paging of older pages
 * (`onEndReached`), and the list follows the latest message while already at
 * the bottom. The partner typing indicator renders in the flipped header (the
 * visual bottom), fed by realtime `typing` events via the typing store.
 */
export function ThreadScreen({ matchId }: { matchId: string }) {
  const { colors } = useTheme();
  const thread = useThread(matchId);
  const { removeMessage } = thread;
  const listRef = useRef<FlashListRef<ThreadMessage>>(null);
  const stickToBottomRef = useRef(true);
  const justSentRef = useRef(false);
  const prevFirstIdRef = useRef<string | null>(null);

  const handleSend = useCallback(
    (body: string) => {
      justSentRef.current = true;
      void sendMessage(matchId, body)
        .then(() => {
          noteThreadChanged(matchId);
          void refreshMatches();
        })
        .catch((error) => console.warn("[thread] send failed", error));
    },
    [matchId]
  );

  const handleRetry = useCallback(
    (messageId: string) => {
      void retryFailedMessage(messageId).then(() => {
        noteThreadChanged(matchId);
        void refreshMatches();
      });
    },
    [matchId]
  );

  const handleDelete = useCallback(
    (messageId: string) => {
      void deleteMessage(messageId).then(() => {
        removeMessage(messageId);
        noteThreadChanged(matchId);
        void refreshMatches();
      });
    },
    [matchId, removeMessage]
  );

  // Pin to the bottom when the newest message changes while we were already at
  // the bottom, or right after sending.
  useEffect(() => {
    const firstId = thread.messages[0]?.id ?? null;
    if (prevFirstIdRef.current !== firstId) {
      const shouldScroll = justSentRef.current || stickToBottomRef.current;
      justSentRef.current = false;
      if (shouldScroll) {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      }
      prevFirstIdRef.current = firstId;
    }
  }, [thread.messages]);

  const onScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    stickToBottomRef.current = event.nativeEvent.contentOffset.y < 40;
  }, []);

  const blocked = getModeSnapshot() !== "member";

  return (
    <View style={styles.screen}>
      {thread.status === "error" ? (
        <View style={styles.statusWrap}>
          <Text variant="bodyMd" color="textSecondary">
            Couldn&apos;t load this conversation.
          </Text>
          <Text variant="labelMd" color="secondary" onPress={thread.retry}>
            Tap to retry
          </Text>
        </View>
      ) : (
        <FlashList
          ref={listRef}
          style={styles.list}
          data={thread.messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Flip>
              <MessageBubble
                message={item}
                senderName={thread.partner?.name}
                onRetry={handleRetry}
                onDelete={handleDelete}
              />
            </Flip>
          )}
          onScroll={onScroll}
          onEndReached={thread.onEndReached}
          onEndReachedThreshold={0.8}
          maintainVisibleContentPosition={{
            autoscrollToTopThreshold: 32,
          }} 
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={FlipSeparator}
          ListHeaderComponent={
            thread.partnerTyping ? (
              <Flip>
                <TypingIndicator name={thread.partner?.name} />
              </Flip>
            ) : null
          }
          ListFooterComponent={
            thread.loadingOlder ? (
              <Flip>
                <View style={styles.olderSpinner}>
                  <ActivityIndicator color={colors.textMuted} />
                </View>
              </Flip>
            ) : thread.tailError ? (
              <Flip>
                <Text
                  variant="bodySm"
                  color="textMuted"
                  onPress={thread.onEndReached}
                  style={styles.olderError}>
                  Couldn&apos;t load earlier messages — tap to retry.
                </Text>
              </Flip>
            ) : null
          }
          ListEmptyComponent={
            thread.status === "ready" ? (
              <Flip>
                <View style={styles.emptyWrap}>
                  <IconSymbol name="heart" size={22} color={colors.iconDefault} />
                  <Text variant="bodyMd" color="textSecondary">
                    You matched — say hi to {thread.partner?.name ?? "your match"}.
                  </Text>
                </View>
              </Flip>
            ) : null
          }
        />
      )}

      <MessageComposer onSend={handleSend} disabled={blocked || thread.status !== "ready"} />
    </View>
  );
}

/**
 * Flips one cell back upright, cancelling the list's `scaleY(-1)` so chat
 * content renders normally while the scroll position is still bottom-anchored.
 */
function Flip({ children }: { children: React.ReactElement }) {
  return <View style={styles.flip}>{children}</View>;
}

function FlipSeparator() {
  return <View style={styles.separator} />;
}

function TypingIndicator({ name }: { name?: string }) {
  return (
    <View style={styles.typingRow}>
      <View style={styles.typingBubble}>
        <Text variant="bodySm" color="textSecondary">
          {(name ? `${name} is typing` : "Someone is typing") + "…"}
        </Text>
      </View>
    </View>
  );
}

export default ThreadScreen;

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
  },
  list: {
    flex: 1,
    transform: [{ scaleY: -1 }],
  },
  flip: {
    transform: [{ scaleY: -1 }],
  },
  listContent: {
    paddingHorizontal: theme.spacing.gutterMobile,
    paddingVertical: theme.spacing.md,
  },
  separator: {
    height: theme.spacing.sm,
  },
  typingRow: {
    alignItems: "flex-start",
  },
  typingBubble: {
    borderRadius: theme.radius.lg,
    borderTopLeftRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  statusWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    padding: theme.spacing.lg,
  },
  emptyWrap: {
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing['3xl'],
  },
  olderSpinner: {
    paddingVertical: theme.spacing.md,
    alignItems: "center",
  },
  olderError: {
    textAlign: "center",
    paddingVertical: theme.spacing.md,
  },
}));