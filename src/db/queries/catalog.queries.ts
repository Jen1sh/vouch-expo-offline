import { and, asc, count, eq, gte, inArray, lte, type SQL } from "drizzle-orm";

import { db, type DbClient } from "@/src/db/client";
import { ensureMigrated } from "@/src/db/migrate";
import {
  catalogProfileInterests,
  catalogProfilePhotos,
  catalogProfiles,
} from "@/src/db/schema/catalog";
import type { BrowseFilters } from "@/src/features/browse/model/browseFilters";
import { SEED_PROFILES } from "@/src/mocks/seed/profiles";

/**
 * The only place that reads or writes the SQLite catalog mirror (CONVENTIONS
 * §8.10). The catalog is seeded once — idempotently, inside a transaction —
 * from the deterministic `SEED_PROFILES` generator, so Discover's in-memory
 * deck and Browse's paginated SQLite list are literally the same 60 people.
 */

/** Builds the SQL WHERE for the Browse filters; undefined = no filter. */
export function buildCatalogWhere(filters: BrowseFilters): SQL | undefined {
  const conditions: SQL[] = [];
  if (filters.ageFrom !== null) {
    conditions.push(gte(catalogProfiles.age, filters.ageFrom));
  }
  if (filters.ageTo !== null) {
    conditions.push(lte(catalogProfiles.age, filters.ageTo));
  }
  if (filters.maxDistanceKm !== null) {
    conditions.push(lte(catalogProfiles.distanceKm, filters.maxDistanceKm));
  }
  if (filters.verifiedOnly) {
    conditions.push(eq(catalogProfiles.verified, true));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

/** A fully-materialized catalog profile for one Browse row. */
export type CatalogBrowseItem = {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  city: string;
  distanceKm: number;
  verified: boolean;
  occupation: string;
  bio: string;
  interests: string[];
  /** Photo at `position = 0`, denormalized for the row thumbnail. */
  photoUri: string;
};

/**
 * One page of the Browse feed, straight from SQLite (LIMIT/OFFSET with a
 * deterministic ORDER BY so pagination never drifts). Fetches `limit + 1` rows
 * to answer `hasMore` without a second COUNT query, then fills the per-row
 * thumbnail + interests with two narrow indexed lookups.
 */
export async function listCatalogPage(input: {
  filters: BrowseFilters;
  limit: number;
  offset: number;
}): Promise<{ items: CatalogBrowseItem[]; hasMore: boolean }> {
  const where = buildCatalogWhere(input.filters);
  const rows = await db
    .select({
      id: catalogProfiles.id,
      firstName: catalogProfiles.firstName,
      lastName: catalogProfiles.lastName,
      age: catalogProfiles.age,
      city: catalogProfiles.city,
      distanceKm: catalogProfiles.distanceKm,
      verified: catalogProfiles.verified,
      occupation: catalogProfiles.occupation,
      bio: catalogProfiles.bio,
    })
    .from(catalogProfiles)
    .where(where)
    .orderBy(asc(catalogProfiles.distanceKm), asc(catalogProfiles.id))
    .limit(input.limit + 1)
    .offset(input.offset);

  const hasMore = rows.length > input.limit;
  const page = rows.slice(0, input.limit);
  if (page.length === 0) {
    return { items: [], hasMore };
  }

  const ids = page.map((row) => row.id);
  const [photos, interests] = await Promise.all([
    db
      .select({
        profileId: catalogProfilePhotos.profileId,
        uri: catalogProfilePhotos.uri,
      })
      .from(catalogProfilePhotos)
      .where(
        and(
          inArray(catalogProfilePhotos.profileId, ids),
          eq(catalogProfilePhotos.position, 0)
        )
      ),
    db
      .select({
        profileId: catalogProfileInterests.profileId,
        tag: catalogProfileInterests.tag,
      })
      .from(catalogProfileInterests)
      .where(inArray(catalogProfileInterests.profileId, ids)),
  ]);

  const photoByProfile = new Map(photos.map((photo) => [photo.profileId, photo.uri]));
  const interestsByProfile = new Map<string, string[]>();
  for (const row of interests) {
    const tags = interestsByProfile.get(row.profileId) ?? [];
    tags.push(row.tag);
    interestsByProfile.set(row.profileId, tags);
  }

  return {
    items: page.map((row) => ({
      ...row,
      interests: interestsByProfile.get(row.id) ?? [],
      photoUri: photoByProfile.get(row.id) ?? "",
    })),
    hasMore,
  };
}

/**
 * Idempotent one-time seed: if the catalog table is empty, load all 60 seeded
 * profiles (+ normalized interests/photos) inside a single transaction. Safe to
 * call on every Browse focus — it is a no-op once the catalog exists.
 */
export async function seedCatalogIfEmpty(): Promise<void> {
  await ensureMigrated();
  const [probe] = await db.select({ n: count() }).from(catalogProfiles);
  if (probe.n > 0) {
    return;
  }

  await db.transaction(async (tx: DbClient) => {
    await tx
      .insert(catalogProfiles)
      .values(
        SEED_PROFILES.map((profile) => ({
          id: profile.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          age: profile.age,
          city: profile.city,
          distanceKm: profile.distanceKm,
          verified: profile.verified,
          occupation: profile.occupation,
          bio: profile.bio,
        }))
      );
    await tx
      .insert(catalogProfileInterests)
      .values(
        SEED_PROFILES.flatMap((profile) =>
          profile.interests.map((tag, position) => ({
            profileId: profile.id,
            tag,
            position,
          }))
        )
      );
    await tx
      .insert(catalogProfilePhotos)
      .values(
        SEED_PROFILES.flatMap((profile) =>
          profile.photos.map((uri, position) => ({
            profileId: profile.id,
            uri,
            position,
          }))
        )
      );
  });
}