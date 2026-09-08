import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable } from "react-native";
import { FlashList, type FlashListRef, type ListRenderItemInfo } from "@shopify/flash-list";
import { router, useFocusEffect } from "expo-router";

import Text from "@/components/Text";
import View from "@/components/View";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { showAppToast } from "@/src/components/AppToast";
import type { CatalogBrowseItem } from "@/src/db/queries/catalog.queries";
import { ensureMigrated } from "@/src/db/migrate";
import { listAllShortlists } from "@/src/db/queries/shortlist.queries";
import BrowseFilterBar from "@/src/features/browse/components/BrowseFilterBar";
import { useBrowseFeed } from "@/src/features/browse/hooks/useBrowseFeed";
import {
  EMPTY_FILTERS,
  type BrowseFilters,
} from "@/src/features/browse/model/browseFilters";
import {
  getShortlisted,
  hydrateFromShortlists,
  toggleShortlist,
} from "@/src/features/voucher/browse/store/user-shortlist";
import VoucherBrowseRow from "@/src/features/voucher/browse/components/VoucherBrowseRow";
import { logVoucherShortlistToggle } from "@/src/features/voucher/browse/performance";
import { useI18n } from "@/src/i18n";
import { useDevPanelControls } from "@/src/mocks/devPanelControls";
import { enqueueShortlist, removeShortlist } from "@/src/outbox";
import { StyleSheet } from "@/src/theme";

/**
 * Voucher Browse tab (REQUIREMENTS §3.9): the same SQLite-paginated feed as
 * member Browse but with a bookmark column instead of a heart. Each row
 * subscribes to only its own shortlist state; toggling is optimistic through
 * the mirror, then durable via the outbox (`enqueueShortlist` /
 * `removeShortlist`). The shortlist mirror re-hydrates on focus so bookmarks
 * made anywhere (list, candidate screen) stay in sync.
 */
export default function VoucherBrowseScreen() {
  const [filters, setFilters] = useState<BrowseFilters>(EMPTY_FILTERS);
  const { items, hasMore, status, tailError, retry, retryTail, onEndReached } =
    useBrowseFeed(filters);
  const listRef = useRef<FlashListRef<CatalogBrowseItem>>(null);
  const controls = useDevPanelControls();
  const { t } = useI18n();

  const applyFilters = useCallback((next: BrowseFilters) => {
    setFilters(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const resetFilters = useCallback(() => applyFilters(EMPTY_FILTERS), [applyFilters]);

  // Optimistic bookmark toggle: flip the row-scoped mirror first, then reach
  // the durable outbox write path. Only the tapped row re-renders.
  const onToggleShortlist = useCallback(
    (profileId: string) => {
      const wasShortlisted = getShortlisted(profileId);
      toggleShortlist(profileId);
      logVoucherShortlistToggle(profileId);
      if (wasShortlisted) {
        void removeShortlist(profileId);
        showAppToast("info", t("browse.unshortlisted"));
      } else {
        void enqueueShortlist(profileId);
        showAppToast("success", t("browse.shortlisted"));
      }
    },
    [t]
  );

  const onPressProfile = useCallback((profileId: string) => {
    router.push({ pathname: "/candidate/[userId]", params: { userId: profileId } });
  }, []);

  // Re-hydrate the shortlist mirror from sqlite on focus so bookmarks made on
  // the candidate screen (or elsewhere) show up without re-fetching the list.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      ensureMigrated()
        .then(() => listAllShortlists())
        .then((rows) => {
          if (active) {
            hydrateFromShortlists(rows);
          }
        })
        .catch((error) => {
          if (active) {
            console.warn("[voucher.browse] failed to refresh shortlist state", error);
          }
        });
      return () => {
        active = false;
      };
    }, [])
  );

  const renderItem = useCallback(
    (info: ListRenderItemInfo<CatalogBrowseItem>) => (
      <VoucherBrowseRow
        profile={info.item}
        onToggleShortlist={onToggleShortlist}
        onPressProfile={onPressProfile}
      />
    ),
    [onToggleShortlist, onPressProfile]
  );

  const renderFooter = useCallback(() => {
    const busy = status === "loading" || hasMore;
    const retryFooter = tailError ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("browse.retryMore")}
        onPress={retryTail}
        style={styles.footerRetry}>
        <Text variant="labelMd" color="textSecondary">
          {t("browse.retryMore")}
        </Text>
      </Pressable>
    ) : null;
    const end = items.length > 0 && !busy && !tailError ? (
      <Text variant="labelCaps" color="textMuted">
        {t("browse.end")}
      </Text>
    ) : null;
    return (
      <View style={styles.footerShell}>
        {busy ? <ActivityIndicator color={styles.footerShell.color} /> : retryFooter ?? end}
      </View>
    );
  }, [tailError, retryTail, status, hasMore, items.length, t]);

  if (status === "error" && items.length === 0) {
    return (
      <View style={styles.screen}>
        <Header offline={controls.offline} />
        <BrowseFilterBar filters={filters} onChange={applyFilters} onReset={resetFilters} />
        <View style={styles.stateCenter}>
          <Text variant="headlineSm" color="textPrimary">
            {t("browse.loadFailed")}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("browse.retry")}
            onPress={retry}
            style={styles.footerRetry}>
            <Text variant="labelMd" color="textSecondary">
              {t("browse.retry")}
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
        ListEmptyComponent={status === "ready" ? <EmptyState onReset={resetFilters} /> : null}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={Separator}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function Header({ offline }: { offline: boolean }) {
  const { t } = useI18n();
  return (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <Text variant="headlineSm" color="textPrimary">
          {t("browse.title")}
        </Text>
        <Text variant="bodySm" color="textMuted">
          {t("browse.shortlistHint")}
        </Text>
      </View>
      {offline ? (
        <View style={styles.offlinePill}>
          <Text variant="labelMd" color="offlineText">
            {t("browse.offlinePill")}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <IconSymbol name="bookmark" size={28} color={styles.emptyIcon.color} />
      </View>
      <Text variant="headlineSm" color="textPrimary">
        {t("browse.emptyTitle")}
      </Text>
      <Text variant="bodyMd" color="textSecondary" style={styles.emptyCaption}>
        {t("browse.emptyCaption")}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("browse.resetFilters")}
        onPress={onReset}
        style={styles.footerRetry}>
        <Text variant="labelMd" color="secondary">
          {t("browse.resetFilters")}
        </Text>
      </Pressable>
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  titleBlock: {
    flex: 1,
    gap: theme.spacing["2xs"],
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
  empty: {
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing["3xl"],
    paddingHorizontal: theme.spacing.lg,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceSubdued,
    color: theme.colors.textMuted,
  },
  emptyCaption: {
    textAlign: "center",
    lineHeight: 21,
  },
}));