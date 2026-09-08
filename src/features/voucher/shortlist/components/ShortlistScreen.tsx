import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable } from "react-native";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { router, useFocusEffect } from "expo-router";

import Button from "@/components/Button";
import Text from "@/components/Text";
import View from "@/components/View";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { showAppToast } from "@/src/components/AppToast";
import { ensureMigrated } from "@/src/db/migrate";
import {
  listShortlistItems,
  type ShortlistItem,
} from "@/src/db/queries/shortlist.queries";
import { useI18n } from "@/src/i18n";
import { setShortlisted } from "@/src/features/voucher/browse/store/user-shortlist";
import ShortlistRow from "@/src/features/voucher/shortlist/components/ShortlistRow";
import { removeShortlist } from "@/src/outbox";
import { StyleSheet } from "@/src/theme";

/**
 * Voucher Shortlist tab (REQUIREMENTS §3.9): every bookmarked candidate with
 * the voucher's inline note, most recently shortlisted first. Loaded from the
 * `shortlisted_profiles` mirror (joined to the catalog), so the whole tab works
 * fully offline. Removing runs through the durable outbox path; the row leaves
 * the list optimistically the moment the user confirms.
 */
export default function ShortlistScreen() {
  const { t } = useI18n();
  const [items, setItems] = useState<ShortlistItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      await ensureMigrated();
      const rows = await listShortlistItems();
      setItems(rows);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      console.warn("[shortlist] failed to load", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    void load();
  }, [load]);

  const remove = useCallback(
    (profileId: string) => {
      setItems((current) => current.filter((item) => item.id !== profileId));
      setShortlisted(profileId, false);
      void removeShortlist(profileId);
      showAppToast("info", t("shortlist.removed"));
    },
    [t]
  );

  const onRemove = useCallback(
    (profileId: string) => {
      const item = items.find((entry) => entry.id === profileId);
      if (!item) {
        return;
      }
      Alert.alert(
        t("shortlist.removeConfirmTitle", { name: item.firstName }),
        t("shortlist.removeConfirmBody"),
        [
          { text: t("shortlist.removeKeep"), style: "cancel" },
          { text: t("shortlist.removeConfirmAction"), style: "destructive", onPress: () => remove(profileId) },
        ]
      );
    },
    [items, remove, t]
  );

  const onPressProfile = useCallback((profileId: string) => {
    router.push({ pathname: "/candidate/[userId]", params: { userId: profileId } });
  }, []);

  const renderItem = useCallback(
    (info: ListRenderItemInfo<ShortlistItem>) => (
      <ShortlistRow
        item={info.item}
        onPressProfile={onPressProfile}
        onRemove={onRemove}
      />
    ),
    [onPressProfile, onRemove]
  );

  if (status === "loading") {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={styles.state.color} />
      </View>
    );
  }

  if (status === "error") {
    return (
      <View style={styles.state}>
        <Text variant="headlineSm" color="textPrimary">
          {t("browse.loadFailed")}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("browse.retry")}
          onPress={() => void load()}>
          <Text variant="labelMd" color="secondary">
            {t("browse.retry")}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text variant="headlineSm" color="textPrimary">
          {t("shortlist.title")}
        </Text>
        <Text variant="bodySm" color="textMuted">
          {t("shortlist.count", { count: String(items.length) })}
        </Text>
      </View>

      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<EmptyState />}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={Separator}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function EmptyState() {
  const { t } = useI18n();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <IconSymbol name="bookmark" size={28} color={styles.emptyIcon.color} />
      </View>
      <Text variant="headlineSm" color="textPrimary">
        {t("shortlist.emptyTitle")}
      </Text>
      <Text variant="bodyMd" color="textSecondary" style={styles.emptyCaption}>
        {t("shortlist.emptyCaption")}
      </Text>
      <Button variant="secondary" onPress={() => router.navigate("/browse")}>
        {t("shortlist.goBrowse")}
      </Button>
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
    gap: theme.spacing["2xs"],
  },
  listContent: {
    paddingBottom: theme.spacing.lg,
  },
  separator: {
    height: theme.spacing.sm,
  },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surface,
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