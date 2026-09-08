import { memo } from "react";
import { Pressable } from "react-native";
import { Image } from "expo-image";

import Text from "@/components/Text";
import View from "@/components/View";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { ShortlistItem } from "@/src/db/queries/shortlist.queries";
import { useI18n } from "@/src/i18n";
import { VouchNoteEditor } from "@/src/features/voucher/shortlist/components/VouchNoteEditor";
import { StyleSheet, useTheme } from "@/src/theme";

type ShortlistRowProps = {
  item: ShortlistItem;
  onPressProfile: (profileId: string) => void;
  onRemove: (profileId: string) => void;
};

/**
 * One shortlisted candidate (REQUIREMENTS §3.9): the bookmark card with the
 * candidate's photo/name/chips plus the inline vouch-note editor. A remove
 * action lives in the trailing column; confirmation happens at the screen
 * level so the same confirm path serves the row and any future action points.
 */
const ShortlistRow = memo(function ShortlistRow({
  item,
  onPressProfile,
  onRemove,
}: ShortlistRowProps) {
  const { t } = useI18n();
  // useTheme(): raw verified-seal color (non-style prop), mirroring BrowseRow.
  const { colors } = useTheme();

  const name = `${item.firstName} ${item.lastName}`;

  return (
    <View testID={`shortlist-row-${item.id}`} style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("shortlist.rowA11y", { name })}
        onPress={() => onPressProfile(item.id)}
        style={({ pressed }) => styles.header(pressed)}>
        <View variant="surfaceSubdued" style={styles.thumbWrap}>
          <Image
            source={{ uri: item.photoUri }}
            style={styles.thumb}
            contentFit="cover"
            transition={80}
            cachePolicy="memory-disk"
            recyclingKey={item.id}
            accessibilityLabel={t("browse.photoA11y", { name: item.firstName })}
          />
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text variant="titleMd" color="textPrimary" numberOfLines={1} style={styles.name}>
              {name}
            </Text>
            {item.verified ? (
              <IconSymbol name="checkmark.seal.fill" size={16} color={colors.tertiary} />
            ) : null}
          </View>
          <Text variant="bodySm" color="textSecondary" numberOfLines={1}>
            {item.age} · {item.city} · {item.distanceKm} km away
          </Text>
          <Text variant="bodySm" color="textMuted" numberOfLines={1}>
            {item.occupation}
          </Text>
        </View>

        <Pressable
          testID={`shortlist-remove-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={t("shortlist.remove", { name: item.firstName })}
          hitSlop={8}
          onPress={() => onRemove(item.id)}
          style={({ pressed }) => styles.removeButton(pressed)}>
          <IconSymbol name="xmark" size={16} color={colors.critical} />
        </Pressable>
      </Pressable>

      <View style={styles.editorWrap}>
        <VouchNoteEditor
          profileId={item.id}
          note={item.note}
          profileName={item.firstName}
        />
      </View>
    </View>
  );
});

export default ShortlistRow;

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
  },
  header: (pressed: boolean) => ({
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderRadius: theme.radius.md,
    padding: theme.spacing["2xs"],
    backgroundColor: pressed ? theme.colors.hoverSurface : "transparent",
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
  removeButton: (pressed: boolean) => ({
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: pressed ? theme.colors.criticalContainer : theme.colors.surfaceSubdued,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  }),
  editorWrap: {
    paddingTop: theme.spacing.xs,
  },
}));