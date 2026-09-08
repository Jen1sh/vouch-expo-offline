import { useSyncExternalStore } from "react";

/**
 * Per-profile reactive projection of the durable `shortlisted_profiles`
 * mirror (REQUIREMENTS §3.4 / §4.6: "toggle one row's state without
 * re-rendering sibling rows"). SQLite stays the source of truth — this module
 * is only a narrow, in-memory selector channel so each voucher Browse row can
 * subscribe to *its* shortlist state and re-render alone. Hydrated on Browse
 * focus via `hydrateFromShortlists(listAllShortlists())` and written
 * optimistically alongside the outbox enqueue (`enqueueShortlist` /
 * `removeShortlist` in `src/outbox/vouching.ts`).
 *
 * Design rule (CONVENTIONS §9): subscribers select a single primitive
 * (`getShortlisted(id)`), so notifying one profile changes nothing for any
 * other row's snapshot — exactly the isolation the requirement asks to prove.
 */

const byProfile = new Map<string, boolean>();
const listeners = new Map<string, Set<() => void>>();

export function getShortlisted(profileId: string): boolean {
  return byProfile.get(profileId) ?? false;
}

function notify(profileId: string): void {
  const set = listeners.get(profileId);
  if (!set) {
    return;
  }
  for (const listener of set) {
    listener();
  }
}

/** Optimistic per-row write; only that profile's subscribers are notified. */
export function setShortlisted(profileId: string, value: boolean): void {
  if (getShortlisted(profileId) === value) {
    return;
  }
  byProfile.set(profileId, value);
  notify(profileId);
}

/**
 * The bookmark toggle transition: shortlisted → not shortlisted (retract),
 * anything else → shortlisted. Shared by the screen's outbox wiring and the
 * isolation tests so the tested behavior is the shipped behavior.
 */
export function toggleShortlist(profileId: string): void {
  setShortlisted(profileId, !getShortlisted(profileId));
}

/** Bulk refresh from `listAllShortlists()`; notifies only profiles whose value changed. */
export function hydrateFromShortlists(
  rows: readonly { profileId: string }[]
): void {
  const next = new Set(rows.map((row) => row.profileId));
  const changed = new Set<string>();

  for (const profileId of next) {
    if (!getShortlisted(profileId)) {
      byProfile.set(profileId, true);
      changed.add(profileId);
    }
  }
  for (const profileId of byProfile.keys()) {
    if (!next.has(profileId) && getShortlisted(profileId)) {
      byProfile.set(profileId, false);
      changed.add(profileId);
    }
  }

  for (const profileId of changed) {
    notify(profileId);
  }
}

export function clearUserShortlist(): void {
  for (const profileId of [...byProfile.keys()]) {
    if (getShortlisted(profileId)) {
      byProfile.set(profileId, false);
      notify(profileId);
    }
  }
}

function subscribeProfile(profileId: string, listener: () => void): () => void {
  let set = listeners.get(profileId);
  if (!set) {
    set = new Set();
    listeners.set(profileId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) {
      listeners.delete(profileId);
    }
  };
}

/**
 * Row-level selector hook. Each row that renders `useUserShortlist(profile.id)`
 * subscribes only to its own profile; a toggle somewhere else re-renders
 * exactly one row.
 */
export function useUserShortlist(profileId: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => subscribeProfile(profileId, onStoreChange),
    () => getShortlisted(profileId),
    () => getShortlisted(profileId)
  );
}