import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

import { IconSymbol } from "@/components/ui/icon-symbol";
import Text from "@/components/Text";
import View from "@/components/View";
import { StyleSheet, useTheme } from "@/src/theme";

type ProfileHeaderProps = {
  firstName: string;
  lastName: string;
  age: number;
  verified: boolean;
  occupation: string;
  city: string;
  distanceKm: number;
  /** Vertical scroll offset of the host ScrollView (drives the collapse). */
  offset: SharedValue<number>;
};

/**
 * The scroll-reactive editorial header (REQUIREMENTS §3.5): name + age in
 * Newsreader with a verified seal, then occupation / city / distance. As the
 * page scrolls, the meta line fades first and the name line collapses upward
 * after it — all driven by Reanimated shared-value interpolation on the UI
 * thread (no `setState` per frame, §4.6).
 */
export function ProfileHeader({
  firstName,
  lastName,
  age,
  verified,
  occupation,
  city,
  distanceKm,
  offset,
}: ProfileHeaderProps) {
  // useTheme(): raw `tertiary` passed to the verified seal's non-style color prop.
  const { colors } = useTheme();

  const nameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [0, 140], [1, 0], "clamp"),
    transform: [{ translateY: interpolate(offset.value, [0, 140], [0, -12], "clamp") }],
  }));

  const metaStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [0, 80], [1, 0], "clamp"),
    transform: [{ translateY: interpolate(offset.value, [0, 80], [0, -6], "clamp") }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.nameRow, nameStyle]}>
        <Text variant="headlineMd" color="textPrimary" style={styles.name}>
          {firstName} {lastName}, {age}
        </Text>
        {verified ? (
          <IconSymbol name="checkmark.seal.fill" size={18} color={colors.tertiary} />
        ) : null}
      </Animated.View>

      <Animated.View style={[styles.meta, metaStyle]}>
        <Text variant="labelMd" color="textSecondary">
          {occupation}
        </Text>
        <Text variant="bodySm" color="textMuted">
          {city} · {distanceKm} km away
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: {
    paddingHorizontal: theme.spacing.gutterMobile,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    marginTop: -theme.spacing.xs,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  name: {
    flexShrink: 1,
  },
  meta: {
    gap: theme.spacing["2xs"],
  },
}));