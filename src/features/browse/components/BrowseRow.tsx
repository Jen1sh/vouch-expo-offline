import { memo } from "react";
import { Pressable } from "react-native";
import { Image } from "expo-image";

import Text from "@/components/Text";
import View from "@/components/View";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BrowseRowRenderBadge } from "@/src/features/browse/performance";
import { useUserSwipe } from "@/src/features/browse/store/user-swipes";
import { StyleSheet, useTheme } from "@/src/theme";
import type { CatalogBrowseItem } from "@/src/db/queries/catalog.queries";

type BrowseRowProps = {
  profile: CatalogBrowseItem;
  onToggleLike: (profileId: string) => void;
  onPressProfile: (profileId: string) => void;
};

/**
 * One Browse list row (REQUIREMENTS §3.4). Memoized + keyed by profile id and,
 * critically, subscribed to *only its own* like decision via
 * `useUserSwipe(profile.id)` — the list `data` never changes on a toggle, so
 * a like here re-renders exactly one row. `BrowseRowRenderBadge` makes the
 * isolation observable as a per-row `×N`.
 */
const BrowseRow = memo(function BrowseRow({ profile, onToggleLike, onPressProfile }: BrowseRowProps) {
  // useTheme(): raw glyph colors for the heart + verified seal (non-style props).
  const { colors } = useTheme();
  const decision = useUserSwipe(profile.id);
  const liked = decision === "like";

  const name = `${profile.firstName} ${profile.lastName}`;
  const likeLabel = liked ? `Remove like from ${profile.firstName}` : `Like ${profile.firstName}`;

  return (
    <Pressable
      testID={`browse-row-${profile.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${profile.age}, ${profile.city}, ${profile.distanceKm}km away`}
      onPress={() => onPressProfile(profile.id)}
      style={({ pressed }) => styles.row(pressed)}>
      <View variant="surfaceSubdued" style={styles.thumbWrap}>
        <Image
          source={{ uri: profile.photoUri }}
          style={styles.thumb}
          contentFit="cover"
          transition={80}
          cachePolicy="memory-disk"
          // expo-image + FlashList recycling: a reused cell must reset its image
          // state or it flashes another profile's photo (or a blank) in place.
          recyclingKey={profile.id}
          accessibilityLabel={`Photo of ${profile.firstName}`}
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

      <View style={styles.likeColumn}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={likeLabel}
          accessibilityState={{ selected: liked }}
          hitSlop={8}
          onPress={() => onToggleLike(profile.id)}
          style={({ pressed }) => styles.likeButton(liked, pressed)}>
          <IconSymbol
            name={liked ? "heart.fill" : "heart"}
            size={22}
            color={liked ? colors.secondary : colors.iconDefault}
          />
        </Pressable>
        {__DEV__ ? <BrowseRowRenderBadge profileId={profile.id} /> : null}
      </View>
    </Pressable>
  );
});

export default BrowseRow;

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
  likeColumn: {
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing["2xs"],
  },
  likeButton: (liked: boolean, pressed: boolean) => ({
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: liked ? theme.colors.secondaryContainer : pressed ? theme.colors.hoverSurface : "transparent",
  }),
}));