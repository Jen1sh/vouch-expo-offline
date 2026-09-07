import { describe, expect, it } from "@jest/globals";

import {
  BACKOFF_BASE_MS,
  BACKOFF_CAP_MS,
  backoffDelayMs,
  exceedsAttemptCap,
  jitterDelay,
  MAX_OUTBOX_ATTEMPTS,
  nextBackoffDelayMs,
} from "@/src/outbox/backoff";

describe("outbox backoff schedule", () => {
  it("grows exponentially from the base without jitter", () => {
    expect(backoffDelayMs(1)).toBe(BACKOFF_BASE_MS);
    expect(backoffDelayMs(2)).toBe(BACKOFF_BASE_MS * 2);
    expect(backoffDelayMs(3)).toBe(BACKOFF_BASE_MS * 4);
  });

  it("clamps at the cap no matter how many attempts", () => {
    expect(backoffDelayMs(10)).toBe(BACKOFF_CAP_MS);
    expect(backoffDelayMs(100)).toBe(BACKOFF_CAP_MS);
  });

  it("applies a ±20% jitter band", () => {
    expect(jitterDelay(1_000, () => 0)).toBe(800);
    expect(jitterDelay(1_000, () => 1)).toBe(1_200);
    expect(jitterDelay(1_000, () => 0.5)).toBe(1_000);
  });

  it("combines exponential + jitter under the cap for the real schedule", () => {
    expect(nextBackoffDelayMs(2, () => 0)).toBe(2_000 * 0.8);
    expect(nextBackoffDelayMs(20, () => 1)).toBe(BACKOFF_CAP_MS * 1.2);
  });

  it("permanently fails an item past the retry cap", () => {
    expect(exceedsAttemptCap(MAX_OUTBOX_ATTEMPTS - 1)).toBe(false);
    expect(exceedsAttemptCap(MAX_OUTBOX_ATTEMPTS)).toBe(true);
    expect(exceedsAttemptCap(MAX_OUTBOX_ATTEMPTS + 1)).toBe(true);
  });
});