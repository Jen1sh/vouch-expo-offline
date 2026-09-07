import { Image } from "expo-image";

import Text from "@/components/Text";
import View from "@/components/View";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { StyleSheet, useTheme } from "@/src/theme";
import type { Profile } from "@/src/types/profile";

/**
 * Presentational card face for one profile (DESIGN.md §2). Photo tile up top,
 * editorial name + verified badge, meta line, interest chips, then a short
 * bio. `expo-image` never shows a blank surface — the tile carries a warm
 * placeholder behind a cross-fade while the URL resolves (a full swipe-through
 * has already prefetched the next few, so the placeholder is rarely visible).
 */
export default function SwipeCard({ profile }: { profile: Profile }) {
  // useTheme(): pure leaf — raw `tertiary` for the verified seal's non-style color.
  const { colors } = useTheme();

  return (
    <View style={styles.card}>
      <View style={styles.photoWrap}>
        <Image
          source={{ uri: profile.photos[0] }}
          style={styles.photo}
          contentFit="cover"
          transition={120}
          accessibilityLabel={`Photo of ${profile.firstName}`}
        />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="headlineSm" color="textPrimary" style={styles.name} numberOfLines={1}>
            {profile.firstName} {profile.lastName}, {profile.age}
          </Text>
          {profile.verified ? (
            <View style={styles.verifiedRow}>
              <IconSymbol name="checkmark.seal.fill" size={16} color={colors.tertiary} />
              <Text variant="labelMd" color="tertiary">
                Verified
              </Text>
            </View>
          ) : null}
        </View>

        <Text variant="labelMd" color="textSecondary">
          {profile.occupation}
        </Text>
        <Text variant="bodySm" color="textMuted">
          {profile.city} · {profile.distanceKm} km away
        </Text>

        <View style={styles.chips}>
          {profile.interests.slice(0, 4).map((interest) => (
            <View key={interest} style={styles.chip}>
              <Text variant="labelMd" color="textSecondary">
                {interest}
              </Text>
            </View>
          ))}
        </View>

        <Text variant="bodySm" color="textSecondary" style={styles.bio} numberOfLines={2}>
          {profile.bio}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    flex: 1,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceElevated,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  photoWrap: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSubdued,
  },
  photo: {
    flex: 1,
  },
  body: {
    padding: theme.spacing.cardInset,
    gap: theme.spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  name: {
    flexShrink: 1,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing['2xs'],
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  chip: {
    backgroundColor: theme.colors.surfaceSubdued,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing['2xs'],
  },
  bio: {
    marginTop: theme.spacing.xs,
  },
}));