import { and, desc, eq, inArray } from "drizzle-orm";

import { db, type DbClient } from "@/src/db/client";
import { catalogProfilePhotos, catalogProfiles } from "@/src/db/schema/catalog";
import { matches, type MatchRow } from "@/src/db/schema/matches";
import { messages } from "@/src/db/schema/messages";
import { SELF_SENDER_ID } from "@/src/db/queries/messages.queries";

/**
 * The only place that reads or writes the `matches` mirror (CONVENTIONS §8.10).
 * The matches-list query joins the catalog for partner identity, sweeps the
 * thread's messages once, and computes unread/preview in JS — the dataset is
 * small enough that one ordered sweep is simpler (and inherently consistent)
 * than nested grouped SQL.
 */

export function upsertMatch(
  client: DbClient,
  input: { id: string; profileId: string; createdAt: Date }
): Promise<unknown> {
  return client
    .insert(matches)
    .values({ id: input.id, profileId: input.profileId, createdAt: input.createdAt })
    .onConflictDoNothing();
}

export async function getMatch(client: DbClient, id: string): Promise<MatchRow | undefined> {
  const [row] = await client.select().from(matches).where(eq(matches.id, id)).limit(1);
  return row;
}

export function setMatchRead(client: DbClient, id: string, at: Date): Promise<unknown> {
  return client.update(matches).set({ lastReadAt: at }).where(eq(matches.id, id));
}

/** One row the matches list renders: partner identity + thread digest. */
export type MatchListItem = {
  id: string;
  profileId: string;
  firstName: string;
  lastName: string;
  photoUri: string;
  verified: boolean;
  lastMessageBody: string | null;
  lastMessageSenderId: string | null;
  lastMessageAt: number | null;
  lastMessageStatus: "sent" | "queued" | "sending" | "failed" | null;
  unreadCount: number;
  createdAt: number;
};

/**
 * All matches with newest-activity-first ordering.
 * - unread = incoming messages (sender != me) delivered after `lastReadAt`;
 *   a never-opened thread counts all its incoming messages as unread.
 * - preview = the newest message regardless of direction.
 */
export async function listMatches(): Promise<MatchListItem[]> {
  const rows = await db
    .select({
      id: matches.id,
      profileId: matches.profileId,
      firstName: catalogProfiles.firstName,
      lastName: catalogProfiles.lastName,
      verified: catalogProfiles.verified,
      createdAt: matches.createdAt,
      lastReadAt: matches.lastReadAt,
    })
    .from(matches)
    .innerJoin(catalogProfiles, eq(matches.profileId, catalogProfiles.id))
    .orderBy(desc(matches.createdAt));

  if (rows.length === 0) {
    return [];
  }

  const matchIds = rows.map((row) => row.id);
  const [photos, sweep] = await Promise.all([
    db
      .select({ profileId: catalogProfilePhotos.profileId, uri: catalogProfilePhotos.uri })
      .from(catalogProfilePhotos)
      .where(and(inArray(catalogProfilePhotos.profileId, rows.map((row) => row.profileId)), eq(catalogProfilePhotos.position, 0))),
    db
      .select({
        matchId: messages.matchId,
        senderId: messages.senderId,
        body: messages.body,
        status: messages.status,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(inArray(messages.matchId, matchIds))
      .orderBy(desc(messages.createdAt)),
  ]);

  const photoByProfile = new Map(photos.map((photo) => [photo.profileId, photo.uri]));
  const lastById = new Map<string, { body: string; senderId: string; status: MatchListItem["lastMessageStatus"]; at: number }>();
  const unreadById = new Map<string, number>(rows.map((row) => [row.id, 0]));

  for (const message of sweep) {
    if (!lastById.has(message.matchId)) {
      const at = message.createdAt.getTime();
      lastById.set(message.matchId, {
        body: message.body,
        senderId: message.senderId,
        status: message.status as MatchListItem["lastMessageStatus"],
        at,
      });
    }
    const match = rows.find((row) => row.id === message.matchId);
    const isUnread =
      message.senderId !== SELF_SENDER_ID &&
      (match?.lastReadAt == null || message.createdAt.getTime() > match.lastReadAt.getTime());
    if (isUnread) {
      unreadById.set(message.matchId, (unreadById.get(message.matchId) ?? 0) + 1);
    }
  }

  return rows.map((row) => {
    const last = lastById.get(row.id);
    return {
      id: row.id,
      profileId: row.profileId,
      firstName: row.firstName,
      lastName: row.lastName,
      verified: row.verified,
      photoUri: photoByProfile.get(row.profileId) ?? "",
      lastMessageBody: last?.body ?? null,
      lastMessageSenderId: last?.senderId ?? null,
      lastMessageAt: last?.at ?? null,
      lastMessageStatus: last?.status ?? null,
      unreadCount: unreadById.get(row.id) ?? 0,
      createdAt: row.createdAt.getTime(),
    };
  });
}

export function listAllMatches(): Promise<MatchRow[]> {
  return db.select().from(matches).orderBy(desc(matches.createdAt));
}

export function deleteAllMatches(): Promise<unknown> {
  return db.delete(matches);
}

/** Whether a match row already exists (so realtime reconcile can dedupe). */
export async function matchExists(id: string): Promise<boolean> {
  const [row] = await db.select({ id: matches.id }).from(matches).where(eq(matches.id, id)).limit(1);
  return Boolean(row);
}