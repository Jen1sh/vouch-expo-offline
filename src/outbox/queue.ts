import * as Crypto from "expo-crypto";

import { db } from "@/src/db/client";
import { ensureMigrated } from "@/src/db/migrate";
import {
  deleteAllOutboxItems,
  deleteOutboxItem,
  getOutboxItem,
  insertOutboxItem,
  type OutboxItemRow,
} from "@/src/db/queries/outbox.queries";
import { deleteAllSwipes, deleteSwipe, getSwipe, upsertSwipe } from "@/src/db/queries/swipes.queries";
import { deleteAllMatches } from "@/src/db/queries/matches.queries";
import { deleteAllMessages } from "@/src/db/queries/messages.queries";
import { deleteAllShortlists } from "@/src/db/queries/shortlist.queries";
import { deleteAllAppSettings } from "@/src/db/queries/settings.queries";
import type { DecisionDirection } from "@/src/db/schema/swipes";
import { newIdempotencyKey, type OutboxWrite } from "@/src/outbox/actions";
import { attemptDrain } from "@/src/outbox/drain";

/**
 * The single durable write path (REQUIREMENTS §4.1, CONVENTIONS §8.12).
 * Enqueue applies the action optimistically to the swipes mirror and inserts
 * the outbox row in ONE transaction — a crash between the two is impossible.
 * The UI never waits on a network response; `attemptDrain()` is fire-and-forget.
 */

function decisionWrite(direction: DecisionDirection, profileId: string, createdAt: Date): OutboxWrite {
  return {
    id: Crypto.randomUUID(),
    type: direction,
    payload: { profileId, direction },
    idempotencyKey: newIdempotencyKey(),
    createdAt,
  };
}

function undoWrite(profileId: string, createdAt: Date): OutboxWrite {
  return { id: Crypto.randomUUID(), type: "undoDecision", payload: { profileId }, idempotencyKey: newIdempotencyKey(), createdAt };
}

/** like / skip / askVoucher: mirror + outbox in one transaction, then drain. */
export async function enqueueDecision(direction: DecisionDirection, profileId: string): Promise<void> {
  await ensureMigrated();
  const write = decisionWrite(direction, profileId, new Date());
  await db.transaction(async (tx) => {
    await insertOutboxItem(tx, write);
    await upsertSwipe(tx, { profileId, direction, outboxItemId: write.id }, write.createdAt);
  });
  await scheduleDrain();
}

/**
 * Undo the device's latest decision on a profile (one level only).
 * - If the original action is still `queued` it is deleted and the mirror row
 *   rolled back — the server never saw it.
 * - If it already left the queue (`sending`/`done`/`failed`) this enqueues a
 *   compensating `undoDecision`. Drain order makes the original arrive first,
 *   so the final server state is "undecided" either way.
 */
export async function undoDecision(profileId: string): Promise<void> {
  await ensureMigrated();
  await db.transaction(async (tx) => {
    const swipe = await getSwipe(tx, profileId);
    if (!swipe) {
      return;
    }

    const item: OutboxItemRow | undefined = await getOutboxItem(tx, swipe.outboxItemId);
    if (item && item.status === "queued") {
      await deleteOutboxItem(tx, item.id);
      await deleteSwipe(tx, profileId);
      return;
    }

    const write = undoWrite(profileId, new Date());
    await insertOutboxItem(tx, write);
    await deleteSwipe(tx, profileId);
  });
  await scheduleDrain();
}

async function scheduleDrain(): Promise<void> {
  // Drain is single-flight inside; a wake-up timer handles later retries.
  await attemptDrain();
}

/**
 * Clears every outbox + mirror row (Dev Panel "Wipe local data"). Chat tables
 * are cleared too; the deterministic seed (`seedChatIfEmpty`) recreates the
 * three demo matches on the next launch so the demo is always present.
 */
export async function wipeLocalData(): Promise<void> {
  await ensureMigrated();
  await deleteAllOutboxItems();
  await deleteAllSwipes();
  await deleteAllMessages();
  await deleteAllMatches();
  await deleteAllShortlists();
  await deleteAllAppSettings();
}