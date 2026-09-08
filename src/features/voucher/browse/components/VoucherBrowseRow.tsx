import { memo } from "react";
import { Pressable } from "react-native";
import { Image } from "expo-image";

import Text from "@/components/Text";
import View from "@/components/View";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { CatalogBrowseItem } from "@/src/db/queries/catalog.queries";
import { useI18n } from "@/src/i18n";
import { VoucherRowRenderBadge } from "@/src/features/voucher/browse/performance";
import { useUserShortlist } from "@/src/features/voucher/browse/store/user-shortlist";
import { StyleSheet, useTheme } from "@/src/theme";

type VoucherBrowseRowProps = {
  profile: CatalogBrowseItem;
  onToggleShortlist: (profileId: string) => void;
  onPressProfile: (profileId: string) => void;
};

/**
 * One shortlist row (voucher mode, REQUIREMENTS §3.9): same editorial row as
 * Browse but the trailing action is a bookmark instead of a heart. Memoized and
 * subscribed to *only its own* shortlist state via `useUserShortlist(profile.id)`
 * — toggling re-renders exactly one row, observable through the dev-only `×N`
 * badge (`VoucherRowRenderBadge`).
 */
const VoucherBrowseRow = memo(function VoucherBrowseRow({
  profile,
  onToggleShortlist,
  onPressProfile,
}: VoucherBrowseRowProps) {
  // useTheme(): raw gold accent for the filled bookmark; a pure leaf emitter.
  const { colors } = useTheme();
  const shortlisted = useUserShortlist(profile.id);
  const { t } = useI18n();

  const name = `${profile.firstName} ${profile.lastName}`;
  const toggleLabel = shortlisted
    ? t("browse.removeShortlistA11y", { name: profile.firstName })
    : t("browse.addShortlistA11y", { name: profile.firstName });

  return (
    <Pressable
      testID={`voucher-browse-row-${profile.id}`}
      accessibilityRole="button"
      accessibilityLabel={t("browse.rowA11y", {
        name,
        age: String(profile.age),
        city: profile.city,
        distance: String(profile.distanceKm),
      })}
      onPress={() => onPressProfile(profile.id)}
      style={({ pressed }) => styles.row(pressed)}>
      <View variant="surfaceSubdued" style={styles.thumbWrap}>
        <Image
          source={{ uri: profile.photoUri }}
          style={styles.thumb}
          contentFit="cover"
          transition={80}
          cachePolicy="memory-disk"
          recyclingKey={profile.id}
          accessibilityLabel={t("browse.photoA11y", { name: profile.firstName })}
        />
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text variant="titleMd" color="textPrimary" numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          {profile.verified ? (
            <IconSymbol name="checkmark.seal.fill" size={16} color={colors.tertiary} />
          ) : null}
        </View>
        <Text variant="bodySm" color="textSecondary" numberOfLines={1}>
          {profile.age} · {profile.city} · {profile.distanceKm} km away
        </Text>
        <Text variant="bodySm" color="textMuted" numberOfLines={1}>
          {profile.occupation}
        </Text>
      </View>

      <View style={styles.bookmarkColumn}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={toggleLabel}
          accessibilityState={{ selected: shortlisted }}
          hitSlop={8}
          onPress={() => onToggleShortlist(profile.id)}
          style={({ pressed }) => styles.bookmarkButton(shortlisted, pressed)}>
          <IconSymbol
            name={shortlisted ? "bookmark.fill" : "bookmark"}
            size={22}
            color={shortlisted ? colors.secondary : colors.iconDefault}
          />
        </Pressable>
      </View>
    {__DEV__ ? <VoucherRowRenderBadge profileId={profile.id} /> : null}
  </Pressable>
);
});

export default VoucherBrowseRow;

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
  thumbWrap: {
    borderRadius: theme.radius.default,
    overflow: "hidden",
  },
  thumb: {
    width: 56,
    height: 56,
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
  bookmarkColumn: {
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing["2xs"],
  },
  bookmarkButton: (shortlisted: boolean, pressed: boolean) => ({
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: shortlisted
      ? theme.colors.secondaryContainer
      : pressed
        ? theme.colors.hoverSurface
        : "transparent",
  }),
}));