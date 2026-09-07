export const BACKOFF_BASE_MS = 1_000;
export const BACKOFF_CAP_MS = 30_000;
export const MAX_OUTBOX_ATTEMPTS = 5;
/** ±20% deterministic jitter band around the exponential schedule. */
export const JITTER_RATIO = 0.2;

/**
 * Exponential backoff delay (ms) for a failed attempt, without jitter:
 * base · 2^(attempt − 1), clamped at the cap. `attempt` is 1-based — the
 * first failure yields `base`. Kept pure so the schedule is unit-testable;
 * callers inject their own randomness via `jitterDelay`.
 */
export function backoffDelayMs(attempt: number): number {
  const growth = Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(BACKOFF_BASE_MS * growth, BACKOFF_CAP_MS);
}

/**
 * Applies ±JITTER_RATIO around a raw delay. `rand` is injected for
 * deterministic tests and defaults to `Math.random`.
 */
export function jitterDelay(delayMs: number, rand: () => number = Math.random): number {
  const offset = (rand() * 2 - 1) * JITTER_RATIO;
  return Math.round(delayMs * (1 + offset));
}

/** Full schedule for a failed attempt: exponential + jitter, capped. */
export function nextBackoffDelayMs(attempt: number, rand: () => number = Math.random): number {
  return jitterDelay(backoffDelayMs(attempt), rand);
}

/** Whether another retry is allowed after this failure. */
export function exceedsAttemptCap(attempts: number): boolean {
  return attempts >= MAX_OUTBOX_ATTEMPTS;
}