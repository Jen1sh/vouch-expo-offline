import { useSyncExternalStore } from "react";

/**
 * Per-thread revision counter. The realtime consumer bumps a thread's revision
 * when an incoming message is persisted, and the composer bumps it after its
 * own send persists, so an open thread reconciles its loaded pages without
 * polling. Per-match keys mean activity in one thread re-queries only that
 * thread.
 */

const revisions = new Map<string, number>();
const listeners = new Map<string, Set<() => void>>();

export function noteThreadChanged(matchId: string): void {
  revisions.set(matchId, (revisions.get(matchId) ?? 0) + 1);
  const set = listeners.get(matchId);
  if (set) {
    for (const listener of set) {
      listener();
    }
  }
}

export function getThreadRevision(matchId: string): number {
  return revisions.get(matchId) ?? 0;
}

function subscribe(matchId: string, listener: () => void): () => void {
  let set = listeners.get(matchId);
  if (!set) {
    set = new Set();
    listeners.set(matchId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set?.size === 0) {
      listeners.delete(matchId);
    }
  };
}

/** Thread-scoped selector: re-renders only when THIS thread's data changed. */
export function useThreadRevision(matchId: string): number {
  return useSyncExternalStore(
    (onStoreChange) => subscribe(matchId, onStoreChange),
    () => getThreadRevision(matchId),
    () => getThreadRevision(matchId)
  );
}