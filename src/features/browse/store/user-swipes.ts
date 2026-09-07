import { useSyncExternalStore } from "react";

import type { DecisionDirection } from "@/src/db/schema/swipes";

/**
 * Per-profile reactive projection of the durable `swipes` mirror
 * (REQUIREMENTS §3.4 / §4.6: "toggle one row's like state without re-rendering
 * sibling rows"). SQLite stays the source of truth — this module is only a
 * narrow, in-memory selector channel so each Browse row can subscribe to *its*
 * decision and re-render alone. Hydrated on Browse focus via
 * `hydrateFromSwipes(listAllSwipes())` and written optimistically alongside the
 * outbox enqueue (`enqueueDecision` / `undoDecision`).
 *
 * Design rule (CONVENTIONS §9): subscribers select a single primitive
 * (`getDecision(id)`), so notifying one profile changes nothing for any other
 * row's snapshot — exactly the isolation the requirement asks to prove.
 */

export type UserSwipeDecision = DecisionDirection | null; // null = undecided

const byProfile = new Map<string, UserSwipeDecision>();
const listeners = new Map<string, Set<() => void>>();

export function getDecision(profileId: string): UserSwipeDecision {
  return byProfile.get(profileId) ?? null;
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
export function setDecision(profileId: string, decision: UserSwipeDecision): void {
  if (getDecision(profileId) === decision) {
    return;
  }
  byProfile.set(profileId, decision);
  notify(profileId);
}

/**
 * The heart toggle transition: like → undecided (retract), anything else →
 * like. Shared by the screen's outbox wiring and the isolation tests so the
 * tested behavior is the shipped behavior.
 */
export function toggleLike(profileId: string): void {
  setDecision(profileId, getDecision(profileId) === "like" ? null : "like");
}

/** Bulk refresh from `listAllSwipes()`; notifies only profiles whose value changed. */
export function hydrateFromSwipes(
  rows: readonly { profileId: string; direction: DecisionDirection }[]
): void {
  const next = new Map(rows.map((row) => [row.profileId, row.direction] as const));
  const changed = new Set<string>();

  for (const [profileId, decision] of next) {
    if (byProfile.get(profileId) !== decision) {
      byProfile.set(profileId, decision);
      changed.add(profileId);
    }
  }
  for (const profileId of byProfile.keys()) {
    if (!next.has(profileId) && byProfile.get(profileId) !== null) {
      byProfile.set(profileId, null);
      changed.add(profileId);
    }
  }

  for (const profileId of changed) {
    notify(profileId);
  }
}

export function clearUserSwipes(): void {
  for (const profileId of [...byProfile.keys()]) {
    if (byProfile.get(profileId) !== null) {
      byProfile.set(profileId, null);
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
 * Row-level selector hook. Each row that renders `useUserSwipe(profile.id)`
 * subscribes only to its own profile; a like toggle somewhere else re-renders
 * exactly one row.
 */
export function useUserSwipe(profileId: string): UserSwipeDecision {
  return useSyncExternalStore(
    (onStoreChange) => subscribeProfile(profileId, onStoreChange),
    () => getDecision(profileId),
    () => getDecision(profileId)
  );
}