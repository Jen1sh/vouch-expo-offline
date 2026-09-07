import { useSyncExternalStore } from "react";

/**
 * Per-match "typing…" indicator driven by realtime `typing` events (REQUIREMENTS
 * §3.6: typing indicator from the simulated realtime, not a local fake timer).
 * A typing event sets the indicator on and restarts a short auto-clear so the
 * line stays visible only while the partner is "still typing"; no further
 * events end it. Keyed per match so one thread typing never affects another.
 */

const TYPING_VISIBLE_MS = 3500;

const active = new Set<string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Map<string, Set<() => void>>();

function notify(matchId: string): void {
  const set = listeners.get(matchId);
  if (set) {
    for (const listener of set) {
      listener();
    }
  }
}

/** Mark the partner typing; restarts the visible window. */
export function beginTyping(matchId: string): void {
  if (!active.has(matchId)) {
    active.add(matchId);
    notify(matchId);
  }
  const timer = timers.get(matchId);
  if (timer) {
    clearTimeout(timer);
  }
  timers.set(
    matchId,
    setTimeout(() => {
      timers.delete(matchId);
      if (active.delete(matchId)) {
        notify(matchId);
      }
    }, TYPING_VISIBLE_MS)
  );
}

export function getTypingSnapshot(matchId: string): boolean {
  return active.has(matchId);
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

/** Thread-scoped selector: re-renders only when this match's typing changes. */
export function useTyping(matchId: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => subscribe(matchId, onStoreChange),
    () => getTypingSnapshot(matchId),
    () => getTypingSnapshot(matchId)
  );
}