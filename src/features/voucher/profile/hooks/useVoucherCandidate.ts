import { useCallback, useEffect, useState } from "react";

import { ensureMigrated } from "@/src/db/migrate";
import {
  getCatalogProfileDetail,
  type CatalogProfileDetail,
} from "@/src/db/queries/catalog.queries";

export type CandidateStatus = "loading" | "ready" | "error";

/**
 * Loads one catalog profile for the voucher candidate screen
 * (REQUIREMENTS §3.9). Same single-source-of-truth rule as `useProfile`: the
 * catalog mirror in SQLite is the only place the profile is read; the screen
 * layer adds the shortlist mirror on top via `useUserShortlist`.
 */
export function useVoucherCandidate(profileId: string) {
  const [profile, setProfile] = useState<CatalogProfileDetail | undefined>();
  const [status, setStatus] = useState<CandidateStatus>("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      await ensureMigrated();
      const found = await getCatalogProfileDetail(profileId);
      setProfile(found);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      console.warn("[voucher.candidate] failed to load", error);
    }
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { profile, status, retry: load };
}