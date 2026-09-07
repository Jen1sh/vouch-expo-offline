import { count } from "drizzle-orm";

import { db } from "@/src/db/client";
import { ensureMigrated } from "@/src/db/migrate";
import { matches } from "@/src/db/schema/matches";
import { messages } from "@/src/db/schema/messages";
import { SEED_PROFILES } from "@/src/mocks/seed/profiles";
import { SELF_SENDER_ID } from "@/src/db/queries/messages.queries";

/**
 * Deterministic first-run chat seed (REQUIREMENTS §3.6 demo path). Because the
 * app ships no real network, three matches with message history are seeded so
 * the matches list, unread badges, history paging, and the inverted thread are
 * demonstrable immediately — no manual swiping or message-sending required.
 * Idempotent: a no-op once `matches` has any row, and re-runs automatically
 * after a "Wipe local data" (which clears chat tables) on the next launch.
 *
 * All seeded rows are incoming/`sent` with no outbox linkage, so nothing here
 * ever drains — they are history, not pending work.
 */

const PARTNER_LINES = [
  "Hey! Saw we matched — how's your week been?",
  "Guilty — I'm a sucker for good coffee too.",
  "Okay real question: dodgy kebab at 2am or not?",
  "That bio line made me actually laugh out loud.",
  "I've never hiked that trail, but now I want to.",
  "You're giving 'keeps plants alive' and I respect it.",
  "Tell me something you're unusually good at.",
  "Between us, the secret dessert place is closing soon.",
] as const;

const SELF_LINES = [
  "Busy but good — finally catching up on sleep.",
  "Coffee is non-negotiable, I make no apologies.",
  "2am kebab is a character trait, not a food choice.",
  "Good bios are harder than good conversations.",
  "The trail is great; the view at the top is the reason.",
  "I water things and they tend to forgive me.",
  "I can parallel-park a 7-seater. That's the flex.",
  "Say the word and we're going before it closes.",
] as const;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function messageId(matchId: string, index: number): string {
  return `${matchId}-msg-${String(index).padStart(3, "0")}`;
}

/**
 * Idempotent seed of the three guaranteed demo matches. Only runs when the
 * `matches` table is empty so it never duplicates or reorders on relaunch.
 */
export async function seedChatIfEmpty(): Promise<void> {
  await ensureMigrated();
  const [probe] = await db.select({ n: count() }).from(matches);
  if (probe.n > 0) {
    return;
  }

  const partnerA = SEED_PROFILES[0];
  const partnerB = SEED_PROFILES[1];
  const partnerC = SEED_PROFILES[2];

  const now = Date.now();

  // Match A — 55 messages spread over ~2 weeks so the "load older messages"
  // paging gesture on scroll-up has real content to page through.
  const matchAId = "match-seed-treasure";
  const spanMinutes = 14 * 24 * 60 / 55;
  const matchAMessages: { senderId: string; body: string; at: Date }[] = [];
  for (let i = 0; i < 55; i += 1) {
    const at = new Date(now - (14 * 24 * 60 - i * spanMinutes) * MINUTE_MS);
    matchAMessages.push({
      senderId: i % 2 === 0 ? partnerA.id : SELF_SENDER_ID,
      body: i % 2 === 0 ? PARTNER_LINES[i % PARTNER_LINES.length] : SELF_LINES[i % SELF_LINES.length],
      at,
    });
  }

  // Match B — 6 messages, the newest 2 are INCOMING and after lastReadAt,
  // so the matches list shows an unread badge without any user action.
  const matchBId = "match-seed-saturday";
  const matchBMessages: { senderId: string; body: string; at: Date }[] = [
    { senderId: partnerB.id, body: PARTNER_LINES[0], at: new Date(now - 90 * MINUTE_MS) },
    { senderId: SELF_SENDER_ID, body: SELF_LINES[0], at: new Date(now - 86 * MINUTE_MS) },
    { senderId: partnerB.id, body: PARTNER_LINES[2], at: new Date(now - 84 * MINUTE_MS) },
    { senderId: SELF_SENDER_ID, body: SELF_LINES[1], at: new Date(now - 80 * MINUTE_MS) },
    { senderId: partnerB.id, body: "Love that. I know a trail with a view worth the climb.", at: new Date(now - 12 * MINUTE_MS) },
    { senderId: partnerB.id, body: "We should go this Saturday if you're free?", at: new Date(now - 9 * MINUTE_MS) },
  ];

  // Match C — 4 messages, everything read. A "clean" row next to B's badge.
  const matchCId = "match-seed-book";
  const matchCMessages: { senderId: string; body: string; at: Date }[] = [
    { senderId: SELF_SENDER_ID, body: "Thanks for the recommendation — the book was great!", at: new Date(now - 3 * 24 * HOUR_MS) },
    { senderId: partnerC.id, body: "Told you. Want the sequel too?", at: new Date(now - (2 * 24 + 22) * HOUR_MS) },
    { senderId: SELF_SENDER_ID, body: "Yes, please.", at: new Date(now - (2 * 24 + 20) * HOUR_MS) },
    { senderId: partnerC.id, body: "It's on your table. Enjoy!", at: new Date(now - (2 * 24 + 18) * HOUR_MS) },
  ];

  await db.transaction(async (tx) => {
    await tx.insert(matches).values([
      { id: matchAId, profileId: partnerA.id, createdAt: new Date(now - 14 * 24 * HOUR_MS), lastReadAt: new Date(now - HOUR_MS) },
      { id: matchBId, profileId: partnerB.id, createdAt: new Date(now - 2 * 24 * HOUR_MS), lastReadAt: new Date(now - 30 * MINUTE_MS) },
      { id: matchCId, profileId: partnerC.id, createdAt: new Date(now - 3 * 24 * HOUR_MS), lastReadAt: new Date(now - 24 * HOUR_MS) },
    ]);

    for (const [matchId, threadMsgs] of [
      [matchAId, matchAMessages],
      [matchBId, matchBMessages],
      [matchCId, matchCMessages],
    ] as const) {
      for (let i = 0; i < threadMsgs.length; i += 1) {
        const row = threadMsgs[i];
        await tx.insert(messages).values({
          id: messageId(matchId, i),
          matchId,
          senderId: row.senderId,
          body: row.body,
          status: "sent",
          outboxItemId: null,
          createdAt: row.at,
          updatedAt: row.at,
        });
      }
    }
  });
}