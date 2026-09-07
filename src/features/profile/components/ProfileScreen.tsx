import { useCallback } from "react";
import { ActivityIndicator, Pressable } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";

import Text from "@/components/Text";
import View from "@/components/View";
import type { DecisionDirection } from "@/src/db/schema/swipes";
import { setDecision } from "@/src/features/browse/store/user-swipes";
import { ProfileActionBar } from "@/src/features/profile/components/ProfileActionBar";
import { ProfileBody } from "@/src/features/profile/components/ProfileBody";
import { ProfileGallery } from "@/src/features/profile/components/ProfileGallery";
import { ProfileHeader } from "@/src/features/profile/components/ProfileHeader";
import { useProfile } from "@/src/features/profile/hooks/useProfile";
import { enqueueDecision, undoDecision } from "@/src/outbox";
import { StyleSheet } from "@/src/theme";

type ProfileScreenProps = {
  profileId: string;
};

/**
 * The profile screen (REQUIREMENTS §3.5): a paging photo gallery, an editorial
 * scroll-reactive header, bio/interests, and the Discover-style like/skip/ask
 * action bar — plus a Message CTA when the profile already matched. The header
 * collapse runs on Reanimated shared values only (see ProfileHeader), so no
 * React state changes per scroll frame.
 */
export function ProfileScreen({ profileId }: ProfileScreenProps) {
  const { profile, status, decision, matchedMatchId, retry } = useProfile(profileId);
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const onAction = useCallback(
    (direction: DecisionDirection) => {
      // Same toggle semantics as Browse/Discover: re-pressing the current
      // decision retracts it (one level), anything else enqueues it — all
      // through the single durable outbox write path.
      if (decision === direction) {
        setDecision(profileId, null);
        void undoDecision(profileId);
      } else {
        setDecision(profileId, direction);
        void enqueueDecision(direction, profileId);
      }
    },
    [decision, profileId]
  );

  if (status === "loading" && !profile) {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={styles.state.color} />
      </View>
    );
  }

  if (status === "error" && !profile) {
    return (
      <View style={styles.state}>
        <Text variant="headlineSm" color="textPrimary">
          {"Couldn't load this profile"}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry loading this profile"
          onPress={retry}>
          <Text variant="labelMd" color="secondary">
            Tap to retry
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!profile) {
    return null;
  }

  const name = `${profile.firstName} ${profile.lastName}`;

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        <ProfileGallery photos={profile.photos} profileName={name} />
        <ProfileHeader
          firstName={profile.firstName}
          lastName={profile.lastName}
          age={profile.age}
          verified={profile.verified}
          occupation={profile.occupation}
          city={profile.city}
          distanceKm={profile.distanceKm}
          offset={scrollY}
        />
        <ProfileBody
          bio={profile.bio}
          verified={profile.verified}
          interests={profile.interests}
        />
      </Animated.ScrollView>

      <ProfileActionBar
        profileId={profileId}
        firstName={profile.firstName}
        decision={decision}
        matchId={matchedMatchId}
        onAction={onAction}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xl,
  },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surface,
  },
}));