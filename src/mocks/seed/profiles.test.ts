import { describe, expect, it } from "@jest/globals";

import { SEED_PROFILES } from "@/src/mocks/seed/profiles";

describe("seed catalog (REQUIREMENTS §4.4)", () => {
  it("has at least 60 profiles", () => {
    expect(SEED_PROFILES.length).toBeGreaterThanOrEqual(60);
  });

  it("gives every profile the §4.4 fields, including ≥3 photos", () => {
    for (const profile of SEED_PROFILES) {
      expect(profile.id).toBeTruthy();
      expect(profile.firstName).toBeTruthy();
      expect(typeof profile.age).toBe("number");
      expect(profile.city).toBeTruthy();
      expect(typeof profile.distanceKm).toBe("number");
      expect(typeof profile.verified).toBe("boolean");
      expect(profile.interests.length).toBeGreaterThan(0);
      expect(profile.photos.length).toBeGreaterThanOrEqual(3);
      for (const url of profile.photos) {
        expect(url.startsWith("https://")).toBe(true);
      }
    }
  });

  it("has unique ids and a stable, deterministic order", () => {
    const ids = new Set(SEED_PROFILES.map((profile) => profile.id));
    expect(ids.size).toBe(SEED_PROFILES.length);
    expect(SEED_PROFILES[0].id).toBe("seed-01");
    expect(SEED_PROFILES[SEED_PROFILES.length - 1].id).toBe(`seed-${String(SEED_PROFILES.length).padStart(2, "0")}`);
  });
});