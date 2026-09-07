import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

import { ensureMigrated } from "@/src/db/migrate";
import {
  getCatalogProfileDetail,
  seedCatalogIfEmpty,
  type CatalogProfileDetail,
} from "@/src/db/queries/catalog.queries";
import { getMatchByProfileId } from "@/src/db/queries/matches.queries";
import { listAllSwipes } from "@/src/db/queries/swipes.queries";
import { hydrateFromSwipes, useUserSwipe } from "@/src/features/browse/store/user-swipes";

export type ProfileStatus = "loading" | "ready" | "error";

export type ProfileState = {
  profile: CatalogProfileDetail | null;
  status: ProfileStatus;
  /** The local member's current decision on this profile (like / skip / ask-voucher). */
  decision: ReturnType<typeof useUserSwipe>;
  /** The match thread id when this profile already matched, otherwise null. */
  matchedMatchId: string | null;
  retry: () => void;
};

/**
 * Drives the profile screen (REQUIREMENTS §3.5). Loads the catalog detail +
 * any existing match (an epoch guard drops stale responses), and re-hydrates
 * the per-profile decision mirror from `swipes` whenever the screen regains
 * focus so a like/skip made in Discover or Browse shows up here. The decision
 * itself comes from the narrow per-profile selector (`useUserSwipe`), so
 * acting here never re-renders anything outside this profile.
 */
export function useProfile(profileId: string): ProfileState {
  const [profile, setProfile] = useState<CatalogProfileDetail | null>(null);
  const [status, setStatus] = useState<ProfileStatus>("loading");
  const [matchedMatchId, setMatchedMatchId] = useState<string | null>(null);
  const epochRef = useRef(0);

  const load = useCallback(async () => {
    const epoch = ++epochRef.current;
    setStatus("loading");
    try {
      await ensureMigrated();
      await seedCatalogIfEmpty();
      const [detail, match] = await Promise.all([
        getCatalogProfileDetail(profileId),
        getMatchByProfileId(profileId),
      ]);
      if (epochRef.current !== epoch) {
        return;
      }
      if (!detail) {
        setStatus("error");
        return;
      }
      setProfile(detail);
      setMatchedMatchId(match?.id ?? null);
      setStatus("ready");
    } catch (error) {
      if (epochRef.current !== epoch) {
        return;
      }
      setStatus("error");
      console.warn("[profile] failed to load", error);
    }
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Re-hydrate the decision mirror on focus so state set elsewhere shows up.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      ensureMigrated()
        .then(() => listAllSwipes())
        .then((rows) => {
          if (active) {
            hydrateFromSwipes(rows);
          }
        })
        .catch((error) => {
          if (active) {
            console.warn("[profile] failed to refresh swipe state", error);
          }
        });
      return () => {
        active = false;
      };
    }, [])
  );

  const decision = useUserSwipe(profileId);

  return { profile, status, decision, matchedMatchId, retry: load };
}