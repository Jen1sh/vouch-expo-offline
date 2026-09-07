import * as Crypto from "expo-crypto";

import { db } from "@/src/db/client";
import { ensureMigrated } from "@/src/db/migrate";
import {
  SELF_SENDER_ID,
  deleteMessageWithOutbox,
  getMessage,
  insertMessage,
  requeueMessageSend,
} from "@/src/db/queries/messages.queries";
import { insertOutboxItem } from "@/src/db/queries/outbox.queries";
import { newIdempotencyKey } from "@/src/outbox/actions";
import { attemptDrain } from "@/src/outbox/drain";
import { getModeSnapshot } from "@/src/store/mode/mode-snapshot";
import {
  removeMessageMirror,
  setMessageStatusMirror,
} from "@/src/features/chat/store/message-status";

/**
 * Durable chat write path (REQUIREMENTS §3.6/§4.1). Sending a message inserts
 * the `messages` mirror row (status `queued`) and its outbox item in ONE
 * transaction — a crash between the two is impossible — then wakes the drain,
 * which advances the mirror to `sending` → `sent`/`failed` while running the
 * network call. The UI never waits on the network; state comes from the
 * message-status mirror store synchronously.
 */

export type SendMessageResult = { messageId: string };

/** Voucher accounts have no 1:1 chat (REQUIREMENTS §3.7) — refuse at the door. */
function assertCanMessage(): void {
  if (getModeSnapshot() !== "member") {
    throw new Error("Voucher mode cannot message matches; chat is member-only.");
  }
}

/**
 * Send a chat message optimistically: durable mirror row + outbox item in one
 * transaction, then a fire-and-forget drain kick.
 */
export async function sendMessage(matchId: string, body: string): Promise<SendMessageResult> {
  await ensureMigrated();
  assertCanMessage();

  const now = new Date();
  const messageId = Crypto.randomUUID();
  const itemId = Crypto.randomUUID();
  const write = {
    id: itemId,
    type: "sendMessage" as const,
    payload: { matchId, messageId, body },
    idempotencyKey: newIdempotencyKey(),
    createdAt: now,
  };

  await db.transaction(async (tx) => {
    await insertOutboxItem(tx, write);
    await insertMessage(tx, {
      id: messageId,
      matchId,
      senderId: SELF_SENDER_ID,
      body,
      status: "queued",
      outboxItemId: itemId,
      createdAt: now,
      updatedAt: now,
    });
  });

  setMessageStatusMirror(messageId, "queued");
  await attemptDrain();
  return { messageId };
}

/** Retry a `failed` message: requeue outbox + mirror atomically, drain. */
export async function retryFailedMessage(messageId: string): Promise<void> {
  await ensureMigrated();
  assertCanMessage();

  const row = await getMessage(db, messageId);
  if (!row || row.status !== "failed" || !row.outboxItemId) {
    return;
  }

  await requeueMessageSend(row.outboxItemId, messageId, new Date());
  setMessageStatusMirror(messageId, "queued");
  await attemptDrain();
}

/**
 * Delete a local-only outgoing message: `failed` (never reached the server) or
 * `queued` (still waiting). Removes the mirror row and its outbox item together.
 * Delivered messages (`sent`) are immutable — no retraction in scope.
 */
export async function deleteMessage(messageId: string): Promise<void> {
  await ensureMigrated();
  assertCanMessage();

  const row = await getMessage(db, messageId);
  if (!row || row.senderId !== SELF_SENDER_ID) {
    return;
  }
  if (row.status !== "failed" && row.status !== "queued") {
    return;
  }

  await deleteMessageWithOutbox(db, messageId, row.outboxItemId);
  removeMessageMirror(messageId);
}