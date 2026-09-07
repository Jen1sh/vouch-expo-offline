import { and, asc, desc, eq, lte } from "drizzle-orm";

import { db, type DbClient } from "@/src/db/client";
import { messages, type MessageRow, type MessageStatus } from "@/src/db/schema/messages";
import { outboxItems } from "@/src/db/schema/outbox";

/**
 * The only place that reads or writes the `messages` mirror (CONVENTIONS §8.10).
 * Enqueue-side calls receive a transaction so the message row and its outbox
 * item can be written atomically; the drain worker uses the transaction-combined
 * helpers below so an outbox status change and the linked message's status change
 * can never land in different transactions.
 */

export const SELF_SENDER_ID = "me";

export type MessageInsert = {
  id: string;
  matchId: string;
  senderId: string;
  body: string;
  status: MessageStatus;
  outboxItemId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function insertMessage(client: DbClient, input: MessageInsert): Promise<unknown> {
  return client.insert(messages).values(input);
}

/**
 * Newest-first keyset page of a thread. `beforeCreatedAt` + `beforeId` pin the
 * cursor so appended older pages never duplicate or drift; passes the exact
 * sent message out for hydration.
 */
export async function listMessagesPage(
  matchId: string,
  input: { limit: number; before?: { createdAt: Date; id: string } }
): Promise<{ items: MessageRow[]; hasMore: boolean }> {
  const where = input.before
    ? and(
        eq(messages.matchId, matchId),
        lte(messages.createdAt, input.before.createdAt)
      )
    : eq(messages.matchId, matchId);

  const rows = await db
    .select()
    .from(messages)
    .where(where)
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(input.limit + 1);

  const hasMore = rows.length > input.limit;
  const page = rows.slice(0, input.limit);

  // A keyset cursor can double-report the row whose createdAt matches the last
  // seen boundary; de-dupe while keeping the ordering.
  if (input.before) {
    const deduped = page.filter((row) => row.id !== input.before!.id);
    return { items: deduped, hasMore: deduped.length === input.limit && hasMore };
  }
  return { items: page, hasMore };
}

/** Bulk-read for a thread: newest-first full set, used by hydration/eyeball. */
export async function listMessagesForMatch(matchId: string): Promise<MessageRow[]> {
  return db
    .select()
    .from(messages)
    .where(eq(messages.matchId, matchId))
    .orderBy(asc(messages.createdAt), asc(messages.id));
}

export async function getMessage(
  client: DbClient,
  id: string
): Promise<MessageRow | undefined> {
  const [row] = await client.select().from(messages).where(eq(messages.id, id)).limit(1);
  return row;
}

export function setMessageStatus(
  client: DbClient,
  id: string,
  status: MessageStatus,
  at: Date
): Promise<unknown> {
  return client
    .update(messages)
    .set({ status, updatedAt: at })
    .where(eq(messages.id, id));
}

/**
 * Flip the linked message to `sending`. Called by the drain worker INSIDE the
 * outbox claim transaction (via the claim callback) so the outbox item and its
 * visible message state change atomically — a crash can never leave the mirror
 * claiming a message that isn't marked in-flight.
 */
export function transitionMessageToSending(
  client: DbClient,
  messageId: string,
  at: Date
): Promise<unknown> {
  return setMessageStatus(client, messageId, "sending", at);
}

/**
 * Atomic retry from `failed`: clears the outbox item's failure (reset attempts,
 * immediately due) and the linked message's `failed` state together.
 */
export async function requeueMessageSend(
  outboxItemId: string,
  messageId: string,
  at: Date
): Promise<unknown> {
  return db.transaction(async (tx) => {
    await tx
      .update(outboxItems)
      .set({ status: "queued", attempts: 0, nextAttemptAt: null, lastError: null, updatedAt: at })
      .where(eq(outboxItems.id, outboxItemId));
    await tx.update(messages).set({ status: "queued", updatedAt: at }).where(eq(messages.id, messageId));
  });
}

/**
 * Receipt helper for the drain worker: given a queued message's outbox item,
 * returns the message row so the drain can transition it to `sending` before
 * the network attempt. `client` defaults to the shared db; pass the claim
 * transaction to look the row up atomically inside it.
 */
export async function getMessageForOutboxItem(
  outboxItemId: string,
  client: DbClient = db
): Promise<MessageRow | undefined> {
  const [row] = await client.select().from(messages).where(eq(messages.outboxItemId, outboxItemId)).limit(1);
  return row;
}

/** Atomic: mark outbox item done + the linked message `sent`. */
export async function markMessageSent(
  outboxItemId: string,
  messageId: string,
  at: Date
): Promise<unknown> {
  return db.transaction(async (tx) => {
    await tx.update(outboxItems).set({ status: "done", updatedAt: at }).where(eq(outboxItems.id, outboxItemId));
    await tx.update(messages).set({ status: "sent", updatedAt: at }).where(eq(messages.id, messageId));
  });
}

/**
 * Atomic: back a message off with its outbox item (goes back to `queued` with
 * a next attempt). Used when the send failed transiently.
 */
export async function rescheduleMessageSend(
  outboxItemId: string,
  messageId: string,
  backoff: { attempts: number; nextAttemptAt: Date },
  lastError: string,
  at: Date
): Promise<unknown> {
  return db.transaction(async (tx) => {
    await tx
      .update(outboxItems)
      .set({
        status: "queued",
        attempts: backoff.attempts,
        nextAttemptAt: backoff.nextAttemptAt,
        lastError,
        updatedAt: at,
      })
      .where(eq(outboxItems.id, outboxItemId));
    await tx.update(messages).set({ status: "queued", updatedAt: at }).where(eq(messages.id, messageId));
  });
}

/** Atomic: permanently fail the outbox item + the linked message. */
export async function failMessageSend(
  outboxItemId: string,
  messageId: string,
  attempts: number,
  lastError: string,
  at: Date
): Promise<unknown> {
  return db.transaction(async (tx) => {
    await tx
      .update(outboxItems)
      .set({ status: "failed", attempts, nextAttemptAt: null, lastError, updatedAt: at })
      .where(eq(outboxItems.id, outboxItemId));
    await tx.update(messages).set({ status: "failed", updatedAt: at }).where(eq(messages.id, messageId));
  });
}

/** Delete an outgoing message and its outbox item together (failed/queued only). */
export async function deleteMessageWithOutbox(
  client: DbClient,
  messageId: string,
  outboxItemId: string | null
): Promise<unknown> {
  return client.transaction(async (tx) => {
    await tx.delete(messages).where(eq(messages.id, messageId));
    if (outboxItemId) {
      await tx.delete(outboxItems).where(eq(outboxItems.id, outboxItemId));
    }
  });
}

/** All message rows (used to wipe chat data with the rest of local state). */
export function listAllMessages(): Promise<MessageRow[]> {
  return db.select().from(messages).orderBy(asc(messages.createdAt));
}

export function deleteAllMessages(): Promise<unknown> {
  return db.delete(messages);
}