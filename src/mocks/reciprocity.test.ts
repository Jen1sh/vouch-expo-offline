import { jest, describe, it, expect, beforeEach } from "@jest/globals";

import {
  reciprocates,
  matchIdForProfile,
  maybeEmitMatchOnLike,
  getMatchEmitCount,
  resetMatchEmitCursor,
} from "@/src/mocks/reciprocity";
import { SEED_PROFILES } from "@/src/mocks/seed/profiles";

jest.mock("@/src/realtime/realtimeChannel", () => ({
  emit: jest.fn(),
}));

describe("simulated mutual-like (REQUIREMENTS §2.1.3/§4.3)", () => {
  beforeEach(() => resetMatchEmitCursor());

  it("is deterministic: no reciprocation for unknown profiles", () => {
    expect(reciprocates("nope")).toBe(false);
  });

  it("reciprocates a fixed, deterministic subset of the seed catalog", () => {
    const results = SEED_PROFILES.map((p) => reciprocates(p.id));
    // The rule is index % 3 === 0 || index % 5 === 0 — no randomness.
    const expected = SEED_PROFILES.map((_, i) => i % 3 === 0 || i % 5 === 0);
    expect(results).toEqual(expected);
    expect(results.some(Boolean)).toBe(true);
    expect(results.filter(Boolean).length).toBeGreaterThan(1);
  });

  it("derives a stable match id per profile", () => {
    expect(matchIdForProfile(SEED_PROFILES[0].id)).toBe(`match-${SEED_PROFILES[0].id}`);
  });

  it("emits a matches:new event only when the profile reciprocates", async () => {
    const recip = SEED_PROFILES.find((p) => reciprocates(p.id))!;
    const nonRecip = SEED_PROFILES.find((p) => !reciprocates(p.id))!;

    expect(await maybeEmitMatchOnLike(nonRecip.id)).toBeNull();
    expect(getMatchEmitCount()).toBe(0);

    const matchId = await maybeEmitMatchOnLike(recip.id);
    expect(matchId).toBe(`match-${recip.id}`);
    expect(getMatchEmitCount()).toBe(1);
  });

  it("is a no-op without a profile id", async () => {
    expect(await maybeEmitMatchOnLike(undefined)).toBeNull();
    expect(getMatchEmitCount()).toBe(0);
  });
});