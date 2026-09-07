/**
 * Pure Browse filter model (REQUIREMENTS §3.4: age range, distance, verified
 * only). Every transition is a pure function so the filter bar UI and the SQL
 * WHERE builder (`buildCatalogWhere` in `src/db/queries/catalog.queries.ts`)
 * share one source of truth with no drift between them.
 */

export type BrowseFilters = {
  /** Inclusive low end of the age range; null = unbounded. */
  ageFrom: number | null;
  /** Inclusive high end of the age range; null = unbounded. */
  ageTo: number | null;
  /** "Within X km" maximum; null = any distance. */
  maxDistanceKm: number | null;
  /** Show only verified profiles. */
  verifiedOnly: boolean;
};

export const AGE_BOUNDS = { min: 18, max: 60 } as const;
export const DISTANCE_LIMITS = [10, 25, 50] as const;

export const EMPTY_FILTERS: BrowseFilters = {
  ageFrom: null,
  ageTo: null,
  maxDistanceKm: null,
  verifiedOnly: false,
};

export function isDefaultFilters(filters: BrowseFilters): boolean {
  return (
    filters.ageFrom === null &&
    filters.ageTo === null &&
    filters.maxDistanceKm === null &&
    filters.verifiedOnly === false
  );
}

function clampAge(value: number): number {
  return Math.min(AGE_BOUNDS.max, Math.max(AGE_BOUNDS.min, value));
}

/** Nudge the low end of the age range by `delta` steps (±1), keeping `from <= to`. */
export function nudgeAgeFrom(filters: BrowseFilters, delta: number): BrowseFilters {
  const upper = filters.ageTo ?? AGE_BOUNDS.max;
  const next = clampAge((filters.ageFrom ?? AGE_BOUNDS.min) + delta);
  return { ...filters, ageFrom: Math.min(next, upper) };
}

/** Nudge the high end of the age range by `delta` steps (±1), keeping `from <= to`. */
export function nudgeAgeTo(filters: BrowseFilters, delta: number): BrowseFilters {
  const lower = filters.ageFrom ?? AGE_BOUNDS.min;
  const next = clampAge((filters.ageTo ?? AGE_BOUNDS.max) + delta);
  return { ...filters, ageTo: Math.max(next, lower) };
}

export function setAgeFrom(filters: BrowseFilters, value: number): BrowseFilters {
  return { ...filters, ageFrom: clampAge(value) };
}

export function setAgeTo(filters: BrowseFilters, value: number): BrowseFilters {
  return { ...filters, ageTo: clampAge(value) };
}

export function setMaxDistanceKm(
  filters: BrowseFilters,
  limitKm: number | null
): BrowseFilters {
  return { ...filters, maxDistanceKm: limitKm };
}

export function setVerifiedOnly(filters: BrowseFilters, on: boolean): BrowseFilters {
  return { ...filters, verifiedOnly: on };
}

/** How many filter knobs are currently non-default (badge on the filter pill). */
export function activeFilterCount(filters: BrowseFilters): number {
  return (
    (filters.ageFrom !== null ? 1 : 0) +
    (filters.ageTo !== null ? 1 : 0) +
    (filters.maxDistanceKm !== null ? 1 : 0) +
    (filters.verifiedOnly ? 1 : 0)
  );
}

/** Compact "From–To" label, e.g. "23–39", or "—" when no age filter is set. */
export function ageRangeLabel(filters: BrowseFilters): string {
  if (filters.ageFrom === null && filters.ageTo === null) {
    return "—";
  }
  const from = filters.ageFrom ?? AGE_BOUNDS.min;
  const to = filters.ageTo ?? AGE_BOUNDS.max;
  return `${from}–${to}`;
}

/** "≤25 km" (or "any") label for the distance control. */
export function distanceLabel(limitKm: number | null): string {
  return limitKm === null ? "any" : `≤${limitKm}km`;
}