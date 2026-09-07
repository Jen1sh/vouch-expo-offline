import { useSyncExternalStore } from "react";

import { listMatches, type MatchListItem } from "@/src/db/queries/matches.queries";

/**
 * Reactive projection of the matches list (REQUIREMENTS §3.6). SQLite stays the
 * source of truth; this store memoizes the last `listMatches()` result so the
 * Chat tab renders a snapshot and refreshes on focus or when the realtime
 * consumer reconciles a match/message event. `getSnapshot` returns the stable
 * cached array reference (replaced only on refresh) so `useSyncExternalStore`
 * re-renders exactly on data change.
 */

let cache: readonly MatchListItem[] = [];
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;

async function doRefresh(): Promise<void> {
  const items = await listMatches();
  cache = items;
  notify();
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Request a refresh (fire-and-forget; coalesces concurrent calls). */
export function refreshMatches(): Promise<void> {
  inFlight = inFlight ?? doRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function subscribeMatches(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMatchesSnapshot(): readonly MatchListItem[] {
  return cache;
}

/** View hook: returns the current matches list and re-renders on refreshes. */
export function useMatches(): readonly MatchListItem[] {
  return useSyncExternalStore(subscribeMatches, getMatchesSnapshot, getMatchesSnapshot);
}