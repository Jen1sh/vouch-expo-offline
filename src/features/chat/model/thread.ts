import type { MessageStatus } from "@/src/db/schema/messages";

/**
 * Pure helpers for the inverted thread list (REQUIREMENTS §3.6: "history loads
 * as you scroll up"). The thread stores messages NEWEST-FIRST — index 0 is the
 * visual bottom, where an inverted FlashList anchors. Newer arrivals go to the
 * front (the bottom), when the user scrolls up an older page is appended to the
 * back. Kept framework-free (no DB, no React) so paging/merge behavior is
 * unit-testable on its own. Order ties are resolved by id so keyset pagination
 * never reorders a page.
 */

export type ThreadMessage = {
  id: string;
  matchId: string;
  senderId: string;
  body: string;
  status: MessageStatus;
  outboxItemId: string | null;
  createdAt: number;
};

/** Newest-first ordering; identical timestamps split by id (highest first). */
export function newestFirst(messages: readonly ThreadMessage[]): ThreadMessage[] {
  return [...messages].sort(
    (a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
  );
}

/**
 * Merge a freshly-fetched (newest-first) page into the thread. Everything in
 * `incoming` that isn't already held wins the front; held messages whose ids
 * aren't in the incoming page are kept behind it — the merged order stays
 * newest-first without dropping the older pages the user has already loaded.
 */
export function mergeNewest(
  current: readonly ThreadMessage[],
  incoming: readonly ThreadMessage[]
): ThreadMessage[] {
  const incomingIds = new Set(incoming.map((m) => m.id));
  return [
    ...incoming,
    ...current.filter((message) => !incomingIds.has(message.id)),
  ];
}

/**
 * Append an older page fetched via keyset pagination to the back, dropping any
 * row that was already loaded (the keyset boundary can double-report one row).
 */
export function appendOlder(
  current: readonly ThreadMessage[],
  older: readonly ThreadMessage[]
): ThreadMessage[] {
  const known = new Set(current.map((m) => m.id));
  return [...current, ...older.filter((message) => !known.has(message.id))];
}

/** Replace one message's transport status in place (for local UI merges). */
export function withStatus(
  messages: readonly ThreadMessage[],
  id: string,
  status: MessageStatus
): ThreadMessage[] {
  return messages.map((message) =>
    message.id === id && message.status !== status ? { ...message, status } : message
  );
}

/** Remove a message (deleted failed/queued send). */
export function withoutMessage(
  messages: readonly ThreadMessage[],
  id: string
): ThreadMessage[] {
  return messages.filter((message) => message.id !== id);
}