import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db, type DbClient, type DbTx } from "@/src/db/client";
import {
  catalogProfileInterests,
  catalogProfilePhotos,
  catalogProfiles,
} from "@/src/db/schema/catalog";
import { shortlistedProfiles, type ShortlistRow } from "@/src/db/schema/shortlist";
import type { CatalogBrowseItem } from "@/src/db/queries/catalog.queries";

/**
 * The only place that reads or writes the `shortlisted_profiles` optimistic
 * mirror (CONVENTIONS §8.10). "Not shortlisted" is the absence of a row — the
 * same framing as `swipes`. Enqueue-side calls receive a transaction so the
 * mirror write shares one atomic unit with the outbox insert; the Shortlist
 * screen reads through `listShortlistItems`, which joins the shortlist mirror
 * to the catalog tables so a row carries the candidate's photo, name and
 * chips plus the voucher's current note.
 */

export type ShortlistInput = {
  profileId: string;
  outboxItemId: string;
};

export type ShortlistItem = CatalogBrowseItem & {
  note: string;
  shortlistedAt: Date;
};

export function insertShortlist(tx: DbTx, input: ShortlistInput, now: Date): Promise<unknown> {
  return tx.insert(shortlistedProfiles).values({
    profileId: input.profileId,
    note: "",
    outboxItemId: input.outboxItemId,
    createdAt: now,
    updatedAt: now,
  });
}

/** Roll-back helper for a still-queued Remove: drops the mirror row. */
export function deleteShortlist(tx: DbTx, profileId: string): Promise<unknown> {
  return tx.delete(shortlistedProfiles).where(eq(shortlistedProfiles.profileId, profileId));
}

/** Mirror write paired with an `updateVouchNote` enqueue — same transaction. */
export function upsertShortlistNote(
  tx: DbTx,
  profileId: string,
  note: string,
  now: Date
): Promise<unknown> {
  return tx
    .insert(shortlistedProfiles)
    .values({ profileId, note, outboxItemId: null, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: shortlistedProfiles.profileId,
      set: { note, updatedAt: now },
    });
}

export async function getShortlist(
  client: DbClient,
  profileId: string
): Promise<ShortlistRow | undefined> {
  const [row] = await client
    .select()
    .from(shortlistedProfiles)
    .where(eq(shortlistedProfiles.profileId, profileId))
    .limit(1);
  return row;
}

/**
 * Every mirror row, oldest add first — used to hydrate the in-memory
 * shortlist mirror and to reset it after a wipe.
 */
export function listAllShortlists(): Promise<ShortlistRow[]> {
  return db.select().from(shortlistedProfiles).orderBy(asc(shortlistedProfiles.createdAt));
}

/**
 * Shortlist screen feed: each shortlisted candidate joined to its catalog
 * row, position-0 photo and interests, most recently shortlisted first.
 * Photos/interests are two narrow indexed lookups (`listCatalogPage` pattern)
 * since the catalog normalizes multi-value fields into child tables.
 */
export async function listShortlistItems(): Promise<ShortlistItem[]> {
  const rows = await db
    .select({
      profileId: shortlistedProfiles.profileId,
      note: shortlistedProfiles.note,
      shortlistedAt: shortlistedProfiles.createdAt,
      firstName: catalogProfiles.firstName,
      lastName: catalogProfiles.lastName,
      age: catalogProfiles.age,
      city: catalogProfiles.city,
      distanceKm: catalogProfiles.distanceKm,
      verified: catalogProfiles.verified,
      occupation: catalogProfiles.occupation,
      bio: catalogProfiles.bio,
    })
    .from(shortlistedProfiles)
    .innerJoin(catalogProfiles, eq(shortlistedProfiles.profileId, catalogProfiles.id))
    .orderBy(desc(shortlistedProfiles.createdAt));

  if (rows.length === 0) {
    return [];
  }

  const ids = rows.map((row) => row.profileId);
  const [photos, interests] = await Promise.all([
    db
      .select({ profileId: catalogProfilePhotos.profileId, uri: catalogProfilePhotos.uri })
      .from(catalogProfilePhotos)
      .where(
        and(
          inArray(catalogProfilePhotos.profileId, ids),
          eq(catalogProfilePhotos.position, 0)
        )
      ),
    db
      .select({ profileId: catalogProfileInterests.profileId, tag: catalogProfileInterests.tag })
      .from(catalogProfileInterests)
      .where(inArray(catalogProfileInterests.profileId, ids)),
  ]);

  const photoByProfile = new Map(photos.map((photo) => [photo.profileId, photo.uri]));
  const interestsByProfile = new Map<string, string[]>();
  for (const entry of interests) {
    const tags = interestsByProfile.get(entry.profileId) ?? [];
    tags.push(entry.tag);
    interestsByProfile.set(entry.profileId, tags);
  }

  return rows.map((row) => ({
    id: row.profileId,
    firstName: row.firstName,
    lastName: row.lastName,
    age: row.age,
    city: row.city,
    distanceKm: row.distanceKm,
    verified: row.verified,
    occupation: row.occupation,
    bio: row.bio,
    interests: interestsByProfile.get(row.profileId) ?? [],
    photoUri: photoByProfile.get(row.profileId) ?? "",
    note: row.note,
    shortlistedAt: row.shortlistedAt,
  }));
}

export function deleteAllShortlists(): Promise<unknown> {
  return db.delete(shortlistedProfiles);
}

export type { ShortlistRow };