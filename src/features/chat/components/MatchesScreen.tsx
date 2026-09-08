import { useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";

import Text from "@/components/Text";
import View from "@/components/View";
import MatchRow from "@/src/features/chat/components/MatchRow";
import { MatchesEmptyState } from "@/src/features/chat/components/MatchesEmptyState";
import { useMatches, refreshMatches } from "@/src/features/chat/store/matches";
import { ensureMigrated } from "@/src/db/migrate";
import { seedChatIfEmpty } from "@/src/db/queries/chat.queries";
import { StyleSheet } from "@/src/theme";

/**
 * Matches list (REQUIREMENTS §3.6): reactive snapshot of `listMatches()` rows —
 * partner, preview, latest timestamp, unread pill — refreshed on focus and on
 * every reconciled realtime event. Unread counts come straight from the query.
 */
export function MatchesScreen() {
  const matches = useMatches();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      ensureMigrated()
        .then(() => seedChatIfEmpty())
        .then(() => refreshMatches())
        .catch((error) => console.warn("[chat] matches refresh failed", error));
      return () => {
        // focus cleanup: nothing to cancel
      };
    }, [])
  );

  const openThread = useCallback(
    (matchId: string) => {
      router.push(`/chat/${matchId}`);
    },
    [router]
  );

  if (matches.length === 0) {
    return <MatchesEmptyState />;
  }

  return (
    <View style={styles.screen}>
      <FlashList
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MatchRow match={item} onPress={openThread} />}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text variant="headlineSm" color="textPrimary">
              Matches
            </Text>
            <Text variant="bodySm" color="textMuted">
              {matches.length} conversation{matches.length === 1 ? "" : "s"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

export default MatchesScreen;

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.gutterMobile,
    paddingBottom: theme.spacing['3xl'],
    gap: theme.spacing.xs,
  },
  listHeader: {
    gap: theme.spacing['2xs'],
    paddingBottom: theme.spacing.md,
  },
  separator: {
    height: theme.spacing.xs,
  },
}));