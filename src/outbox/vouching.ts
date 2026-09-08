import * as Crypto from "expo-crypto";

import { db } from "@/src/db/client";
import { ensureMigrated } from "@/src/db/migrate";
import { insertOutboxItem, getOutboxItem, deleteOutboxItem, deleteQueuedNoteUpdates } from "@/src/db/queries/outbox.queries";
import {
  deleteShortlist,
  getShortlist,
  insertShortlist,
  upsertShortlistNote,
} from "@/src/db/queries/shortlist.queries";
import { newIdempotencyKey } from "@/src/outbox/actions";
import { attemptDrain } from "@/src/outbox/drain";
import { getModeSnapshot } from "@/src/store/mode/mode-snapshot";

/**
 * Durable voucher write path (REQUIREMENTS §2.2/§3.7, §4.1). Shortlisting a
 * candidate, removing one, and editing the vouch note all insert their
 * `shortlisted_profiles` mirror row and their outbox item in ONE transaction —
 * a crash between the two is impossible — then wake the single-flight drain,
 * which delivers them in order. The UI never waits on the network; the mirror
 * store is updated optimistically by the caller.
 */

/** Member-only chat is the mirror image of this guard; vouching is voucher-only. */
function assertCanVouch(): void {
  if (getModeSnapshot() !== "voucher") {
    throw new Error("Shortlisting is a voucher-mode action; switch modes in Settings.");
  }
}

/**
 * Add a candidate to the shortlist: durable mirror row + outbox item, then a
 * fire-and-forget drain kick. No-op when the profile is already shortlisted.
 */
export async function enqueueShortlist(profileId: string): Promise<void> {
  await ensureMigrated();
  assertCanVouch();

  const now = new Date();
  await db.transaction(async (tx) => {
    const existing = await getShortlist(tx, profileId);
    if (existing) {
      return;
    }
    const write = {
      id: Crypto.randomUUID(),
      type: "shortlist" as const,
      payload: { profileId },
      idempotencyKey: newIdempotencyKey(),
      createdAt: now,
    };
    await insertOutboxItem(tx, write);
    await insertShortlist(tx, { profileId, outboxItemId: write.id }, now);
  });
  await attemptDrain();
}

/**
 * Remove a candidate from the shortlist.
 * - If the add is still `queued` it is deleted and the mirror row rolled back —
 *   the server never saw the shortlist.
 * - If it already left the queue (`sending`/`done`/`failed`) this enqueues a
 *   compensating `unshortlist`. Drain order makes the add land first, so the
 *   final server state is "not shortlisted" either way.
 */
export async function removeShortlist(profileId: string): Promise<void> {
  await ensureMigrated();
  assertCanVouch();

  await db.transaction(async (tx) => {
    const row = await getShortlist(tx, profileId);
    if (!row) {
      return;
    }
    await deleteShortlist(tx, profileId);
    const addItem = row.outboxItemId
      ? await getOutboxItem(tx, row.outboxItemId)
      : undefined;
    if (addItem && addItem.status === "queued") {
      await deleteOutboxItem(tx, addItem.id);
      await deleteQueuedNoteUpdates(tx, profileId);
      return;
    }
    await insertOutboxItem(tx, {
      id: Crypto.randomUUID(),
      type: "unshortlist",
      payload: { profileId },
      idempotencyKey: newIdempotencyKey(),
      createdAt: new Date(),
    });
  });
  await attemptDrain();
}

/**
 * Persist the voucher's evolving note for a shortlisted candidate. The mirror
 * is updated in the same transaction as the enqueue, so the Shortlist screen
 * shows the text even fully offline; the server receives the latest write for
 * the profile (last-write-wins, matching the `swipes.updatedAt` rule).
 */
export async function enqueueUpdateVouchNote(profileId: string, note: string): Promise<void> {
  await ensureMigrated();
  assertCanVouch();

  const now = new Date();
  await db.transaction(async (tx) => {
    const row = await getShortlist(tx, profileId);
    if (!row) {
      return;
    }
    await insertOutboxItem(tx, {
      id: Crypto.randomUUID(),
      type: "updateVouchNote",
      payload: { profileId, note },
      idempotencyKey: newIdempotencyKey(),
      createdAt: now,
    });
    await upsertShortlistNote(tx, profileId, note, now);
  });
  await attemptDrain();
}