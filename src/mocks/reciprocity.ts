import { emit } from "@/src/realtime/realtimeChannel";
import { SEED_PROFILES } from "@/src/mocks/seed/profiles";

/**
 * Simulated mutual-like (REQUIREMENTS §2.1.3/§4.3). When a `like` drains
 * successfully, the pseudo-server deterministically "likes back" a fixed
 * subset of profiles and emits a realtime `matches:new` event — the exact path
 * a genuine backend would use, so the chat consumer reconciles it the same way
 * it would for a real match. Pure function + module-level cursor: reproducible
 * for tests, holds no DB state.
 */

/** Profiles that reciprocate a like (deterministic subset of the seed catalog). */
export function reciprocates(profileId: string): boolean {
  const index = seedIndex(profileId);
  if (index < 0) {
    return false;
  }
  // Every nth profile likes back; distribution keeps the demo lively without
  // turning every like into a match.
  return index % 3 === 0 || index % 5 === 0;
}

function seedIndex(profileId: string): number {
  return SEED_PROFILES.findIndex((profile) => profile.id === profileId);
}

/** Stable match id per profile so a replayed like can never create two rows. */
export function matchIdForProfile(profileId: string): string {
  return `match-${profileId}`;
}

let matchEmitCursor = 0;

/**
 * Called by the drain after a `like` succeeds. Returns the match id when this
 * like became a mutual match (so callers can log/test), otherwise null.
 */
export async function maybeEmitMatchOnLike(
  profileId: string | undefined
): Promise<string | null> {
  if (typeof profileId !== "string" || !reciprocates(profileId)) {
    return null;
  }
  matchEmitCursor += 1;
  emit({ type: "matches:new", matchId: matchIdForProfile(profileId), profileId });
  return matchIdForProfile(profileId);
}

/** Test/dev: how many mutual matches have been emitted this session. */
export function getMatchEmitCount(): number {
  return matchEmitCursor;
}

export function resetMatchEmitCursor(): void {
  matchEmitCursor = 0;
}