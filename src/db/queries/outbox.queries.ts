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

export async function getOutboxItem(client: DbClient, id: string): Promise<OutboxItemRow | undefined> {
  const [row] = await client.select().from(outboxItems).where(eq(outboxItems.id, id)).limit(1);
  return row;
}

/**
 * Claims the oldest due (`queued`, `nextAttemptAt` passed) item for delivery:
 * flips it to `sending` inside its own transaction so a crash mid-request can
 * never leave two workers sending the same item. Returns null when nothing is
 * due. Ordered by `createdAt` — the queue drains strictly in write order.
 */
export async function claimNextDueItem(
  now: Date,
  client: DbClient = db
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

    return row;
  });
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