import { useCallback } from "react";
import { ActivityIndicator, Pressable } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";

import Button from "@/components/Button";
import Text from "@/components/Text";
import View from "@/components/View";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { showAppToast } from "@/src/components/AppToast";
import { useI18n } from "@/src/i18n";
import {
  getShortlisted,
  toggleShortlist,
  useUserShortlist,
} from "@/src/features/voucher/browse/store/user-shortlist";
import { useVoucherCandidate } from "@/src/features/voucher/profile/hooks/useVoucherCandidate";
import { ProfileBody } from "@/src/features/profile/components/ProfileBody";
import { ProfileGallery } from "@/src/features/profile/components/ProfileGallery";
import { ProfileHeader } from "@/src/features/profile/components/ProfileHeader";
import { enqueueShortlist, removeShortlist } from "@/src/outbox";
import { StyleSheet, useTheme } from "@/src/theme";

type VoucherCandidateScreenProps = {
  profileId: string;
};

/**
 * Candidate detail for voucher mode (REQUIREMENTS §3.9): the same editorial
 * gallery/header/body as the member profile, but the trailing action is a
 * shortlist toggle instead of like/skip/ask — a voucher can only vouch for
 * people, never swipe into a chat. The bookmark stays row-scoped through
 * `useUserShortlist`, and each toggle goes durable through the outbox.
 */
export default function VoucherCandidateScreen({
  profileId,
}: VoucherCandidateScreenProps) {
  const { profile, status, retry } = useVoucherCandidate(profileId);
  const shortlisted = useUserShortlist(profileId);
  const { t } = useI18n();
  // useTheme(): raw `textMuted` for the note-hint glyph (non-style prop).
  const { colors } = useTheme();
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const onToggleShortlist = useCallback(() => {
    const wasShortlisted = getShortlisted(profileId);
    toggleShortlist(profileId);
    if (wasShortlisted) {
      void removeShortlist(profileId);
      showAppToast("info", t("browse.unshortlisted"));
    } else {
      void enqueueShortlist(profileId);
      showAppToast("success", t("browse.shortlisted"));
    }
  }, [profileId, t]);

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
          {t("candidate.loadFailed")}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("candidate.retry")}
          onPress={retry}>
          <Text variant="labelMd" color="secondary">
            {t("candidate.retry")}
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

      <View style={styles.bar}>
        <Button
          size="lg"
          variant={shortlisted ? "secondary" : "primary"}
          onPress={onToggleShortlist}
          accessibilityLabel={
            shortlisted
              ? t("candidate.remove")
              : t("candidate.add", { name: profile.firstName })
          }>
          {shortlisted ? t("candidate.remove") : t("candidate.add", { name: profile.firstName })}
        </Button>
        {shortlisted ? (
          <View style={styles.hintRow}>
            <IconSymbol name="square.and.pencil" size={14} color={colors.textMuted} />
            <Text variant="bodySm" color="textMuted">
              {t("candidate.inShortlist")}
            </Text>
          </View>
        ) : null}
      </View>
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
  bar: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing["2xs"],
  },
}));