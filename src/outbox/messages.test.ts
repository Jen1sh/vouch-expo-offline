import { jest, describe, it, expect, beforeEach } from "@jest/globals";

import { sendMessage, retryFailedMessage, deleteMessage } from "@/src/outbox/messages";
import type { OutboxWrite } from "@/src/outbox/actions";

type MessageRowLike = {
  id: string;
  status: string;
  outboxItemId?: string | null;
  senderId?: string;
};

const mockInsertOutboxItem = jest.fn<(tx: unknown, write: OutboxWrite) => Promise<void>>();
const mockInsertMessage = jest.fn<(tx: unknown, row: unknown) => Promise<void>>();
const mockGetMessage = jest.fn<(client: unknown, id: string) => Promise<MessageRowLike | null>>();
const mockRequeueMessageSend = jest.fn<(itemId: string, messageId: string, at: Date) => Promise<void>>();
const mockDeleteMessageWithOutbox = jest.fn<(client: unknown, messageId: string, itemId: string | null | undefined) => Promise<void>>();
const mockAttemptDrain = jest.fn<() => Promise<{ completed: number }>>().mockResolvedValue({ completed: 0 });
const mockEnsureMigrated = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockTransaction = jest.fn(async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> => cb("fake-tx"));
const mockGetModeSnapshot = jest.fn<() => string>(() => "member");
const mockSetMessageStatusMirror = jest.fn<(messageId: string, status: string) => void>();
const mockRemoveMessageMirror = jest.fn<(messageId: string) => void>();

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => `uuid-${Date.now()}-${Math.random().toString(36).slice(2)}`),
}));

jest.mock("@/src/db/client", () => ({
  db: { transaction: (cb: (tx: unknown) => Promise<unknown>) => mockTransaction(cb) },
}));

jest.mock("@/src/db/migrate", () => ({
  ensureMigrated: () => mockEnsureMigrated(),
}));

jest.mock("@/src/db/queries/outbox.queries", () => ({
  insertOutboxItem: (tx: unknown, write: OutboxWrite) => mockInsertOutboxItem(tx, write),
}));

jest.mock("@/src/db/queries/messages.queries", () => ({
  SELF_SENDER_ID: "self",
  insertMessage: (tx: unknown, row: unknown) => mockInsertMessage(tx, row),
  getMessage: (client: unknown, id: string) => mockGetMessage(client, id),
  requeueMessageSend: (itemId: string, messageId: string, at: Date) => mockRequeueMessageSend(itemId, messageId, at),
  deleteMessageWithOutbox: (client: unknown, messageId: string, itemId: string | null | undefined) =>
    mockDeleteMessageWithOutbox(client, messageId, itemId),
}));

jest.mock("@/src/outbox/drain", () => ({
  attemptDrain: () => mockAttemptDrain(),
}));

jest.mock("@/src/store/mode/mode-snapshot", () => ({
  getModeSnapshot: () => mockGetModeSnapshot(),
}));

jest.mock("@/src/features/chat/store/message-status", () => ({
  setMessageStatusMirror: (messageId: string, status: string) => mockSetMessageStatusMirror(messageId, status),
  removeMessageMirror: (messageId: string) => mockRemoveMessageMirror(messageId),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockAttemptDrain.mockResolvedValue({ completed: 0 });
  mockGetModeSnapshot.mockReturnValue("member");
});

describe("sendMessage (REQUIREMENTS §3.6/§4.1)", () => {
  it("inserts outbox item + message atomically in one transaction", async () => {
    await sendMessage("match-1", "hello");

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockInsertOutboxItem).toHaveBeenCalledTimes(1);
    expect(mockInsertMessage).toHaveBeenCalledTimes(1);

    const outboxArg = mockInsertOutboxItem.mock.calls[0][1];
    expect(outboxArg.type).toBe("sendMessage");
    expect(outboxArg.idempotencyKey).toBeTruthy();

    const msgArg = mockInsertMessage.mock.calls[0][1] as { matchId: string; body: string; status: string };
    expect(msgArg.matchId).toBe("match-1");
    expect(msgArg.body).toBe("hello");
    expect(msgArg.status).toBe("queued");
  });

  it("sets the mirror status to queued", async () => {
    const { messageId } = await sendMessage("match-1", "hello");
    expect(mockSetMessageStatusMirror).toHaveBeenCalledWith(messageId, "queued");
  });

  it("kicks the drain", async () => {
    await sendMessage("match-1", "hello");
    expect(mockAttemptDrain).toHaveBeenCalledTimes(1);
  });

  it("throws when in voucher mode", async () => {
    mockGetModeSnapshot.mockReturnValue("voucher");
    await expect(sendMessage("match-1", "hello")).rejects.toThrow("Voucher mode cannot message matches");
  });
});

describe("retryFailedMessage", () => {
  it("requeues a failed message and drains", async () => {
    mockGetMessage.mockResolvedValue({ id: "msg-1", status: "failed", outboxItemId: "item-1" });

    await retryFailedMessage("msg-1");

    expect(mockRequeueMessageSend).toHaveBeenCalledWith("item-1", "msg-1", expect.any(Date));
    expect(mockSetMessageStatusMirror).toHaveBeenCalledWith("msg-1", "queued");
    expect(mockAttemptDrain).toHaveBeenCalledTimes(1);
  });

  it("no-ops for non-failed messages", async () => {
    mockGetMessage.mockResolvedValue({ id: "msg-1", status: "sent", outboxItemId: "item-1" });
    await retryFailedMessage("msg-1");
    expect(mockRequeueMessageSend).not.toHaveBeenCalled();
  });

  it("no-ops when message does not exist", async () => {
    mockGetMessage.mockResolvedValue(null);
    await retryFailedMessage("msg-1");
    expect(mockRequeueMessageSend).not.toHaveBeenCalled();
  });

  it("throws in voucher mode", async () => {
    mockGetModeSnapshot.mockReturnValue("voucher");
    await expect(retryFailedMessage("msg-1")).rejects.toThrow("Voucher mode cannot message matches");
  });
});

describe("deleteMessage", () => {
  it("deletes a failed message + outbox item and removes mirror", async () => {
    mockGetMessage.mockResolvedValue({ id: "msg-1", status: "failed", outboxItemId: "item-1", senderId: "self" });

    await deleteMessage("msg-1");

    expect(mockDeleteMessageWithOutbox).toHaveBeenCalled();
    expect(mockRemoveMessageMirror).toHaveBeenCalledWith("msg-1");
  });

  it("deletes a queued message", async () => {
    mockGetMessage.mockResolvedValue({ id: "msg-1", status: "queued", outboxItemId: "item-1", senderId: "self" });
    await deleteMessage("msg-1");
    expect(mockDeleteMessageWithOutbox).toHaveBeenCalled();
  });

  it("does not delete a sent message", async () => {
    mockGetMessage.mockResolvedValue({ id: "msg-1", status: "sent", outboxItemId: "item-1", senderId: "self" });
    await deleteMessage("msg-1");
    expect(mockDeleteMessageWithOutbox).not.toHaveBeenCalled();
  });

  it("does not delete messages from other senders", async () => {
    mockGetMessage.mockResolvedValue({ id: "msg-1", status: "failed", outboxItemId: "item-1", senderId: "other" });
    await deleteMessage("msg-1");
    expect(mockDeleteMessageWithOutbox).not.toHaveBeenCalled();
  });
});
