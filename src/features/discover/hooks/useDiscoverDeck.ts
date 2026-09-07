import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  advance,
  createDeck,
  undoDeck,
  type DeckState,
  type SwipeDirection,
} from "@/src/features/discover/model/deck";
import { assertSeedProfiles, SEED_PROFILES } from "@/src/mocks/seed/profiles";
import { enqueueDecision, undoDecision } from "@/src/outbox";
import type { Profile } from "@/src/types/profile";

assertSeedProfiles();

const PROFILE_IDS = SEED_PROFILES.map((profile) => profile.id);

/**
 * Owns the Discover deck state, routes every swipe through the single durable
 * outbox write path (`enqueueDecision`), prefetches the upcoming cards' photos
 * (REQUIREMENTS §3.3: a full swipe-through never shows a loading gap), and
 * exposes the one-level undo that both reverts the deck and reconciles the
 * optimistic mirror.
 */
export function useDiscoverDeck() {
  const [deck, setDeck] = useState<DeckState>(() => createDeck(PROFILE_IDS));

  const profilesById = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const profile of SEED_PROFILES) {
      map.set(profile.id, profile);
    }
    return map;
  }, []);

  const handleSwiped = useCallback((direction: SwipeDirection, profile: Profile) => {
    setDeck((previous) => advance(previous, direction));
    void enqueueDecision(direction, profile.id);
  }, []);

  const handleUndo = useCallback(() => {
    const swiped = deck.lastSwipe;
    if (swiped) {
      void undoDecision(swiped.profileId);
    }
    setDeck((previous) => undoDeck(previous));
  }, [deck.lastSwipe]);

  const handleReset = useCallback(() => {
    setDeck(createDeck(PROFILE_IDS));
  }, []);

  // Prefetch photos for the next few cards on mount and after every advance.
  useEffect(() => {
    const upcoming = deck.remaining
      .slice(0, 4)
      .flatMap((profileId) => profilesById.get(profileId)?.photos ?? []);
    if (upcoming.length > 0) {
      void Image.prefetch(upcoming).catch(() => {
        // Offline or a flaky URL — the <Image> fallback tile still renders.
      });
    }
  }, [deck.remaining, profilesById]);

  return {
    deck,
    profilesById,
    handleSwiped,
    handleUndo,
    handleReset,
  };
}