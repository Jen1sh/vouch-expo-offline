import { db } from "@/src/db/client";
import { getMatch } from "@/src/db/queries/matches.queries";
import { nextIncomingLine } from "../mocks/partnerReply";
import { matchIdForProfile, reciprocates } from "../mocks/reciprocity";
import { SEED_PROFILES } from "../mocks/seed/profiles";
import {
  emit,
  forceDuplicateEvent,
  getLastEmittedEvent,
  nextId,
  subscribeToRealtime,
} from "./publishes";

/**
 * Simulated realtime events (REQUIREMENTS §4.3). The publish/dispatch surface
 * and the event types live in `./publishes` (leaf module) so the mock engines
 * can emit without importing this module — which itself depends on them for its
 * Dev-Panel helpers. Everything from `publishes` is re-exported here unchanged
 * for back-compat.
 */

export type { RealtimeEvent, RealtimeListener } from "./publishes";

/**
 * Dev Panel: push a fresh `new match` event for an unused seed profile.
 * Cycles deterministically through the catalog (skipping the three demo-match
 * partners) so repeated presses keep producing genuinely-new matches.
 */
export function forceMatchEvent(): void {
  const candidates = SEED_PROFILES.slice(3);
  const probe = candidates[forceMatchCursor.value % candidates.length];
  forceMatchCursor.value += 1;
  emit({
    type: "matches:new",
    matchId: matchIdForProfile(probe.id),
    profileId: probe.id,
  });
}

const forceMatchCursor = { value: 0 };

/**
 * Dev Panel: push one genuine incoming message for a match. Resolves the
 * partner's profile so the event carries a real `senderId`, then sends it down
 * the normal realtime path (dedupe/reorder applied) so it behaves identically
 * to a server-pushed message.
 */
export async function forceIncomingMessage(matchId: string): Promise<void> {
  const match = await getMatch(db, matchId);
  if (!match) {
    return;
  }
  emit({
    type: "messages:new",
    matchId,
    messageId: `manual-${nextId("incoming")}`,
    senderId: match.profileId,
    body: nextIncomingLine(),
  });
}

/** Dev Panel: push a `typing` indicator for a match's partner. */
export async function simulateTyping(matchId: string): Promise<void> {
  const match = await getMatch(db, matchId);
  if (!match) {
    return;
  }
  emit({ type: "typing", matchId, userId: match.profileId });
}

/** Used by tests + Dev Panel to prove reciprocity produces match events. */
export function simulateReciprocalLike(profileId: string): boolean {
  if (!reciprocates(profileId)) {
    return false;
  }
  emit({ type: "matches:new", matchId: matchIdForProfile(profileId), profileId });
  return true;
}

export {
  emit,
  forceDuplicateEvent,
  getLastEmittedEvent,
  subscribeToRealtime,
};