import { useSyncExternalStore } from "react";

import type { MessageStatus } from "@/src/db/schema/messages";

/**
 * Narrow, in-memory selector channel for a message's send state (REQUIREMENTS
 * §3.6: the thread must show exactly `queued|sending|sent|failed` and react to
 * drain progress without re-rendering the whole list). SQLite is the source of
 * truth; this mirror is written by the outbox (enqueue, retry, drain outcome,
 * delete) so each bubble can subscribe to *its* message and re-render alone.
 *
 * Design rule (CONVENTIONS §9): subscribers select a single primitive
 * (`getStatus(id)`), so notifying one message changes nothing for any other
 * bubble's snapshot — exactly the isolation §3.6/§4.6 asks to prove.
 */

const statuses = new Map<string, MessageStatus>();
const listeners = new Map<string, Set<() => void>>();

export function getMessageStatus(id: string): MessageStatus | null {
  return statuses.get(id) ?? null;
}

function notifyId(id: string): void {
  const set = listeners.get(id);
  if (set) {
    for (const listener of set) {
      listener();
    }
  }
}

/** Single-message write; only that message's subscribers are notified. */
export function setMessageStatusMirror(id: string, status: MessageStatus): void {
  if (statuses.get(id) === status) {
    return;
  }
  statuses.set(id, status);
  notifyId(id);
}

export function removeMessageMirror(id: string): void {
  if (!statuses.has(id)) {
    return;
  }
  statuses.delete(id);
  notifyId(id);
}

export function clearMessageMirror(): void {
  const ids = [...statuses.keys()];
  statuses.clear();
  for (const id of ids) {
    notifyId(id);
  }
}

function subscribe(id: string, listener: () => void): () => void {
  let set = listeners.get(id);
  if (!set) {
    set = new Set();
    listeners.set(id, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set?.size === 0) {
      listeners.delete(id);
    }
  };
}

/**
 * Bubble-level selector. Each bubble renders `useMessageStatus(message.id)`;
 * a send-state flip for one message re-renders exactly that bubble.
 */
export function useMessageStatus(id: string): MessageStatus | null {
  return useSyncExternalStore(
    (onStoreChange) => subscribe(id, onStoreChange), // per-message subscription
    () => getMessageStatus(id),
    () => getMessageStatus(id)
  );
}