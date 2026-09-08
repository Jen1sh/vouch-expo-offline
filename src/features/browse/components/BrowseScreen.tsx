import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable } from "react-native";
import { FlashList, type FlashListRef, type ListRenderItemInfo } from "@shopify/flash-list";
import { router } from "expo-router";

import Text from "@/components/Text";
import View from "@/components/View";
import BrowseEmptyState from "@/src/features/browse/components/BrowseEmptyState";
import BrowseFilterBar from "@/src/features/browse/components/BrowseFilterBar";
import BrowseRow from "@/src/features/browse/components/BrowseRow";
import { useBrowseFeed } from "@/src/features/browse/hooks/useBrowseFeed";
import {
  EMPTY_FILTERS,
  type BrowseFilters,
} from "@/src/features/browse/model/browseFilters";
import { logBrowseLikeToggle } from "@/src/features/browse/performance";
import { getDecision, toggleLike } from "@/src/features/browse/store/user-swipes";
import { enqueueDecision, undoDecision } from "@/src/outbox";
import { useDevPanelControls } from "@/src/mocks/devPanelControls";
import { StyleSheet } from "@/src/theme";
import type { CatalogBrowseItem } from "@/src/db/queries/catalog.queries";

/**
 * Browse tab (REQUIREMENTS §3.4): an SQLite-paginated FlashList of the same
 * seeded people as Discover, with age/distance/verified filters, per-row like
 * isolation (see `BrowseRow` + `store/user-swipes`) and scroll preservation
 * (react-navigation keeps this screen mounted while the tab is hidden).
 * Rationale for FlashList over FlatList lives in docs/TECHNICAL.md.
 */
export default function BrowseScreen() {
  const [filters, setFilters] = useState<BrowseFilters>(EMPTY_FILTERS);
  const {
    items,
    hasMore,
    status,
    tailError,
    retry,
    retryTail,
    onEndReached,
  } = useBrowseFeed(filters);
  const listRef = useRef<FlashListRef<CatalogBrowseItem>>(null);
  const controls = useDevPanelControls();

  const applyFilters = useCallback((next: BrowseFilters) => {
    setFilters(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const resetFilters = useCallback(() => applyFilters(EMPTY_FILTERS), [applyFilters]);

  // Optimistic, row-scoped like toggle: the mirror flips for the tapped row
  // only, then the decision reaches the durable outbox write path
  // (enqueueDecision / undoDecision). The list's `data` is untouched.
  const onToggleLike = useCallback((profileId: string) => {
    const wasLiked = getDecision(profileId) === "like";
    toggleLike(profileId);
    logBrowseLikeToggle(profileId);
    if (wasLiked) {
      void undoDecision(profileId);
    } else {
      void enqueueDecision("like", profileId);
    }
  }, []);

  const onPressProfile = useCallback((profileId: string) => {
    router.push({ pathname: "/profile/[userId]", params: { userId: profileId } });
  }, []);

  const renderItem = useCallback(
    (info: ListRenderItemInfo<CatalogBrowseItem>) => (
      <BrowseRow
        profile={info.item}
        onToggleLike={onToggleLike}
        onPressProfile={onPressProfile}
      />
    ),
    [onToggleLike, onPressProfile]
  );

  const renderFooter = useCallback(() => {
    const busy = status === "loading" || hasMore;
    const retry = tailError ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry loading more profiles"
        onPress={retryTail}
        style={styles.footerRetry}>
        <Text variant="labelMd" color="textSecondary">
          {"Couldn't load more — tap to retry"}
        </Text>
      </Pressable>
    ) : null;
    const end = items.length > 0 && !busy && !tailError ? (
      <Text variant="labelCaps" color="textMuted">
        {"You've reached the end"}
      </Text>
    ) : null;
    return (
      <View style={styles.footerShell}>
        {busy ? <ActivityIndicator color={styles.footerShell.color} /> : retry ?? end}
      </View>
    );
  }, [tailError, retryTail, status, hasMore, items.length]);

  if (status === "error" && items.length === 0) {
    return (
      <View style={styles.screen}>
        <Header offline={controls.offline} />
        <BrowseFilterBar filters={filters} onChange={applyFilters} onReset={resetFilters} />
        <View style={styles.stateCenter}>
          <Text variant="headlineSm" color="textPrimary">
            {"Couldn't load profiles"}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading profiles"
            onPress={retry}
            style={styles.footerRetry}>
            <Text variant="labelMd" color="textSecondary">
              Tap to retry
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header offline={controls.offline} />
      <BrowseFilterBar filters={filters} onChange={applyFilters} onReset={resetFilters} />

      <FlashList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        ListEmptyComponent={
          status === "ready" ? <BrowseEmptyState onReset={resetFilters} /> : null
        }
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={Separator}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function Header({ offline }: { offline: boolean }) {
  return (
    <View style={styles.header}>
      <Text variant="headlineSm" color="textPrimary">
        Browse
      </Text>
      {offline ? (
        <View style={styles.offlinePill}>
          <Text variant="labelMd" color="offlineText">
            Offline — swipes queued
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.gutterMobile,
    paddingBottom: theme.spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  offlinePill: {
    backgroundColor: theme.colors.offlineBackground,
    borderWidth: 1,
    borderColor: theme.colors.offlineBorder,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing["2xs"],
  },
  listContent: {
    paddingBottom: theme.spacing.lg,
  },
  separator: {
    height: theme.spacing.sm,
  },
  footerShell: {
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    color: theme.colors.textMuted,
  },
  footerRetry: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.sm,
  },
  stateCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
}));