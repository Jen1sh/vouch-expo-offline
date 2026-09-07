import { eq } from "drizzle-orm";

import { db, type DbClient, type DbTx } from "@/src/db/client";
import { swipes, type DecisionDirection, type SwipeRow } from "@/src/db/schema/swipes";

/**
 * The only place that reads or writes the `swipes` optimistic mirror
 * (CONVENTIONS §8.10). The "undecided" state is the absence of a row.
 */

export type SwipeInput = {
  profileId: string;
  direction: DecisionDirection;
  outboxItemId: string;
};

export function upsertSwipe(tx: DbTx, input: SwipeInput, now: Date): Promise<unknown> {
  return tx
    .insert(swipes)
    .values({
      profileId: input.profileId,
      direction: input.direction,
      outboxItemId: input.outboxItemId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: swipes.profileId,
      set: { direction: input.direction, outboxItemId: input.outboxItemId, updatedAt: now },
    });
}

export function deleteSwipe(tx: DbTx, profileId: string): Promise<unknown> {
  return tx.delete(swipes).where(eq(swipes.profileId, profileId));
}

export async function getSwipe(client: DbClient, profileId: string): Promise<SwipeRow | undefined> {
  const [row] = await client.select().from(swipes).where(eq(swipes.profileId, profileId)).limit(1);
  return row;
}

export function deleteAllSwipes(): Promise<unknown> {
  return db.delete(swipes);
}

export type { DecisionDirection, SwipeRow };