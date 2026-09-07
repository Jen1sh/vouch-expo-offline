import { db } from "@/src/db/client";
import { ensureMigrated } from "@/src/db/migrate";
import { seedChatIfEmpty } from "@/src/db/queries/chat.queries";
import { getMatch, upsertMatch } from "@/src/db/queries/matches.queries";
import {
  getMessage,
  insertMessage,
  SELF_SENDER_ID,
} from "@/src/db/queries/messages.queries";
import { refreshMatches } from "@/src/features/chat/store/matches";
import { noteThreadChanged } from "@/src/features/chat/store/thread-revision";
import { beginTyping } from "@/src/features/chat/store/typing";
import { createEventDedupe } from "@/src/realtime/dedupe";
import {
  subscribeToRealtime,
  type RealtimeEvent,
} from "@/src/realtime/realtimeChannel";

/**
 * The chat half of the simulated realtime layer (REQUIREMENTS §4.3). One
 * subscriber owns the chat tables: it reconciles every `matches:new`,
 * `messages:new`, and `typing` event against the durable SQLite mirrors and
 * notifies the narrow UI stores.
 *
 * Dedupe + reconciliation guarantees:
 * - a duplicated delivery (Dev-Panel duplicate rate) or a replayed event never
 *   lands twice — the dedupe drops it by event id BEFORE touching the DB;
 * - an optimistic echo of our own send (the `messages` row already exists) is
 *   skipped, not duplicated — no row can appear twice;
 * - an arrived message for an unknown match is dropped (no orphan rows).
 *
 * Started once from the root layout, idempotently, after the outbox watcher so
 * the demo chat seed is present before the list renders.
 */

let started = false;

/** Test-only: allow a fresh subscription in each test file. */
export function __resetChatRealtimeForTests(): void {
  started = false;
}

export function startChatRealtime(): void {
  if (started) {
    return;
  }
  started = true;

  const dedupe = createEventDedupe();

  // Guarantee the demo threads exist before the Chat tab first renders.
  void seedChatIfEmpty().then(() => void refreshMatches());

  subscribeToRealtime((event) => {
    void handle(event, dedupe);
  });
}

async function handle(event: RealtimeEvent, dedupe: { accept(event: RealtimeEvent): boolean }): Promise<void> {
  if (!dedupe.accept(event)) {
    return;
  }
  await ensureMigrated();

  switch (event.type) {
    case "matches:new":
      await upsertMatch(db, {
        id: event.matchId,
        profileId: event.profileId,
        createdAt: new Date(event.occurredAt),
      });
      void refreshMatches();
      break;

    case "messages:new":
      // Our optimistic echo (sendMessage already wrote this row) — skip so a
      // duplicate can never materialize a second copy.
      if (await getMessage(db, event.messageId)) {
        return;
      }
      // An arrived message for an unknown match is dropped (no orphan rows).
      const match = await getMatch(db, event.matchId);
      if (!match) {
        return;
      }
      const senderId = event.senderId ?? match.profileId;
      if (!senderId || senderId === SELF_SENDER_ID) {
        return;
      }
      const at = new Date(event.occurredAt);
      await insertMessage(db, {
        id: event.messageId,
        matchId: event.matchId,
        senderId,
        body: event.body,
        status: "sent",
        outboxItemId: null,
        createdAt: at,
        updatedAt: at,
      });
      noteThreadChanged(event.matchId);
      void refreshMatches();
      break;

    case "typing":
      beginTyping(event.matchId);
      break;

    case "profiles:updated":
      void refreshMatches();
      break;
  }
}