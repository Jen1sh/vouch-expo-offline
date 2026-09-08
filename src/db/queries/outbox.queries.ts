import { and, asc, eq, isNull, lte, or } from "drizzle-orm";

import { db, type DbClient, type DbTx } from "@/src/db/client";
import { outboxItems, type OutboxItemRow, type OutboxStatus } from "@/src/db/schema/outbox";
import type { OutboxWrite } from "@/src/outbox/actions";

/**
 * The only place that reads or writes `outbox_items` (CONVENTIONS §8.10).
 * Enqueue-side calls receive a transaction (`DbTx`) so the outbox insert can
 * share a transaction with the optimistic mirror write; drain-side calls use
 * the shared `db` — the single-flight guard means exactly one worker reads.
 */

export function insertOutboxItem(tx: DbTx, write: OutboxWrite): Promise<unknown> {
  return tx.insert(outboxItems).values({
    id: write.id,
    type: write.type,
    payload: write.payload,
    idempotencyKey: write.idempotencyKey,
    status: "queued",
    attempts: 0,
    nextAttemptAt: null,
    createdAt: write.createdAt,
    updatedAt: write.createdAt,
  });
}

export function deleteOutboxItem(tx: DbTx, id: string): Promise<unknown> {
  return tx.delete(outboxItems).where(eq(outboxItems.id, id));
}

/**
 * Cancels every still-`queued` `updateVouchNote` for a profile. Used when a
 * shortlist add that never left the queue is rolled back — the note edits that
 * only made sense while that add sat pending should vanish with it, or the
 * server would receive note text for a candidate it was never told to shortlist.
 */
export async function deleteQueuedNoteUpdates(tx: DbTx, profileId: string): Promise<void> {
  const candidates = await tx
    .select({ id: outboxItems.id, payload: outboxItems.payload })
    .from(outboxItems)
    .where(and(eq(outboxItems.type, "updateVouchNote"), eq(outboxItems.status, "queued")));
  for (const candidate of candidates) {
    if (candidate.payload.profileId === profileId) {
      await tx.delete(outboxItems).where(eq(outboxItems.id, candidate.id));
    }
  }
}

export async function getOutboxItem(client: DbClient, id: string): Promise<OutboxItemRow | undefined> {
  const [row] = await client.select().from(outboxItems).where(eq(outboxItems.id, id)).limit(1);
  return row;
}

/**
 * Claims the oldest due (`queued`, `nextAttemptAt` passed) item for delivery:
 * flips it to `sending` inside its own transaction so a crash mid-request can
 * never leave two workers sending the same item. Returns null when nothing is
 * due. Ordered by `createdAt` — the queue drains strictly in write order.
 * `onClaimed` runs inside the same transaction (after the flip) so a linked
 * mirror row — e.g. a chat message's visible state — becomes `sending`
 * atomically with the outbox claim.
 */
export async function claimNextDueItem(
  now: Date,
  client: DbClient = db,
  onClaimed?: (tx: DbTx, claimed: OutboxItemRow) => Promise<void>
): Promise<OutboxItemRow | null> {
  return client.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(outboxItems)
      .where(
        and(
          eq(outboxItems.status, "queued"),
          or(isNull(outboxItems.nextAttemptAt), lte(outboxItems.nextAttemptAt, now))
        )
      )
      .orderBy(asc(outboxItems.createdAt))
      .limit(1);

    if (!row) {
      return null;
    }

    await tx
      .update(outboxItems)
      .set({ status: "sending", updatedAt: now })
      .where(eq(outboxItems.id, row.id));

    if (onClaimed) {
      await onClaimed(tx, row);
    }

    return row;
  });
}

/**
 * Recovery for items left in `sending` by a previous drain — a hard kill
 * mid-request or an offline interrupt. Marks them `queued` and immediately due
 * again at every drain start, so a relaunch (or a later drain) picks them up
 * exactly once. Returns the recovered rows so the drain worker can mirror any
 * linked message status back to `queued` (the two writes are idempotent and
 * self-heal on the next drain if a crash lands between them).
 */
export async function recoverInFlightItems(now: Date): Promise<OutboxItemRow[]> {
  const rows = await db.select().from(outboxItems).where(eq(outboxItems.status, "sending"));
  if (rows.length === 0) {
    return [];
  }
  for (const row of rows) {
    await db
      .update(outboxItems)
      .set({ status: "queued", nextAttemptAt: null, updatedAt: now })
      .where(eq(outboxItems.id, row.id));
  }
  return rows;
}

export function markOutboxItemDone(id: string, doneAt: Date): Promise<unknown> {
  return db.update(outboxItems).set({ status: "done", updatedAt: doneAt }).where(eq(outboxItems.id, id));
}

/** Clears the in-flight `sending` marker; item goes back to the queue with a backoff. */
export function scheduleOutboxRetry(
  id: string,
  attempts: number,
  nextAttemptAt: Date,
  lastError: string,
  updatedAt: Date
): Promise<unknown> {
  return db
    .update(outboxItems)
    .set({ status: "queued", attempts, nextAttemptAt, lastError, updatedAt })
    .where(eq(outboxItems.id, id));
}

/** Permanently fails an item (retry cap reached); it stays visible to the user. */
export function failOutboxItem(
  id: string,
  attempts: number,
  lastError: string,
  failedAt: Date
): Promise<unknown> {
  return db
    .update(outboxItems)
    .set({ status: "failed", attempts, nextAttemptAt: null, lastError, updatedAt: failedAt })
    .where(eq(outboxItems.id, id));
}

export async function listOutboxItems(): Promise<OutboxItemRow[]> {
  return db.select().from(outboxItems).orderBy(asc(outboxItems.createdAt));
}

export function deleteAllOutboxItems(): Promise<unknown> {
  return db.delete(outboxItems);
}

export type { OutboxItemRow, OutboxStatus };