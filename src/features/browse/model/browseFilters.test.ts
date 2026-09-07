import { describe, expect, it } from "@jest/globals";

import {
  activeFilterCount,
  AGE_BOUNDS,
  ageRangeLabel,
  distanceLabel,
  EMPTY_FILTERS,
  isDefaultFilters,
  nudgeAgeFrom,
  nudgeAgeTo,
  setMaxDistanceKm,
  setVerifiedOnly,
} from "@/src/features/browse/model/browseFilters";

describe("browse filters (REQUIREMENTS §3.4)", () => {
  it("starts empty (no filters) and reports exactly one active knob per set filter", () => {
    expect(isDefaultFilters(EMPTY_FILTERS)).toBe(true);
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);

    const withAge = nudgeAgeFrom(EMPTY_FILTERS, 1);
    const withDistance = setMaxDistanceKm(withAge, 25);
    const withVerified = setVerifiedOnly(withDistance, true);
    expect(activeFilterCount(withVerified)).toBe(3);
    expect(isDefaultFilters(withVerified)).toBe(false);
  });

  it("clamps age nudges to the catalog bounds", () => {
    expect(nudgeAgeFrom(EMPTY_FILTERS, -1).ageFrom).toBe(AGE_BOUNDS.min);
    const atMax = { ...EMPTY_FILTERS, ageFrom: AGE_BOUNDS.max };
    expect(nudgeAgeFrom(atMax, 1).ageFrom).toBe(AGE_BOUNDS.max);
  });

  it("never lets 'from' exceed 'to' or 'to' fall below 'from'", () => {
    const fromToSame = { ...EMPTY_FILTERS, ageFrom: 30, ageTo: 30 };
    expect(nudgeAgeFrom(fromToSame, 1).ageFrom).toBe(30);
    expect(nudgeAgeFrom(fromToSame, 1).ageTo).toBe(30);

    expect(nudgeAgeTo(fromToSame, -1).ageTo).toBe(30);
  });

  it("stores a null distance as 'any' and a set one as ≤N km", () => {
    expect(distanceLabel(null)).toBe("any");
    expect(distanceLabel(25)).toBe("≤25km");
    expect(setMaxDistanceKm(EMPTY_FILTERS, 10).maxDistanceKm).toBe(10);
    expect(setMaxDistanceKm(EMPTY_FILTERS, null).maxDistanceKm).toBeNull();
  });

  it("renders a compact age range label and expands nulls to the bounds", () => {
    expect(ageRangeLabel(EMPTY_FILTERS)).toBe("—");
    expect(ageRangeLabel({ ...EMPTY_FILTERS, ageFrom: 23, ageTo: 39 })).toBe("23–39");
  });
});