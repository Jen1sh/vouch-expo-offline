import { jest, describe, it, expect, beforeEach } from "@jest/globals";

import { enqueueDecision, undoDecision, wipeLocalData } from "@/src/outbox/queue";
import type { OutboxItemRow } from "@/src/db/schema/outbox";
import type { OutboxWrite } from "@/src/outbox/actions";

const mockInsertOutboxItem = jest.fn<(tx: unknown, write: OutboxWrite) => Promise<void>>();
const mockUpsertSwipe = jest.fn<(tx: unknown, row: { profileId: string; direction: string; outboxItemId: string }, at: Date) => Promise<void>>();
const mockGetSwipe = jest.fn<(tx: unknown, profileId: string) => Promise<{ outboxItemId: string } | undefined>>();
const mockGetOutboxItem = jest.fn<(tx: unknown, id: string) => Promise<OutboxItemRow | undefined>>();
const mockDeleteOutboxItem = jest.fn<(tx: unknown, id: string) => Promise<void>>();
const mockDeleteSwipe = jest.fn<(tx: unknown, profileId: string) => Promise<void>>();
const mockDeleteAllOutboxItems = jest.fn<() => Promise<void>>();
const mockDeleteAllSwipes = jest.fn<() => Promise<void>>();
const mockDeleteAllMessages = jest.fn<() => Promise<void>>();
const mockDeleteAllMatches = jest.fn<() => Promise<void>>();
const mockDeleteAllShortlists = jest.fn<() => Promise<void>>();
const mockDeleteAllAppSettings = jest.fn<() => Promise<void>>();
const mockAttemptDrain = jest.fn<() => Promise<{ completed: number }>>().mockResolvedValue({ completed: 0 });
const mockEnsureMigrated = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockTransaction = jest.fn(async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> => cb("fake-tx"));

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
  getOutboxItem: (tx: unknown, id: string) => mockGetOutboxItem(tx, id),
  deleteOutboxItem: (tx: unknown, id: string) => mockDeleteOutboxItem(tx, id),
  deleteAllOutboxItems: () => mockDeleteAllOutboxItems(),
}));

jest.mock("@/src/db/queries/swipes.queries", () => ({
  upsertSwipe: (tx: unknown, row: unknown, at: Date) => mockUpsertSwipe(tx, row as Parameters<typeof mockUpsertSwipe>[1], at),
  getSwipe: (tx: unknown, profileId: string) => mockGetSwipe(tx, profileId),
  deleteSwipe: (tx: unknown, profileId: string) => mockDeleteSwipe(tx, profileId),
  deleteAllSwipes: () => mockDeleteAllSwipes(),
}));

jest.mock("@/src/db/queries/matches.queries", () => ({
  deleteAllMatches: () => mockDeleteAllMatches(),
}));

jest.mock("@/src/db/queries/messages.queries", () => ({
  deleteAllMessages: () => mockDeleteAllMessages(),
}));

jest.mock("@/src/db/queries/shortlist.queries", () => ({
  deleteAllShortlists: () => mockDeleteAllShortlists(),
}));

jest.mock("@/src/db/queries/settings.queries", () => ({
  deleteAllAppSettings: () => mockDeleteAllAppSettings(),
}));

jest.mock("@/src/outbox/drain", () => ({
  attemptDrain: () => mockAttemptDrain(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockAttemptDrain.mockResolvedValue({ completed: 0 });
});

describe("enqueueDecision (REQUIREMENTS §4.1)", () => {
  it("inserts an outbox item + swipe atomically in one transaction", async () => {
    await enqueueDecision("like", "profile-1");

    expect(mockEnsureMigrated).toHaveBeenCalled();
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockInsertOutboxItem).toHaveBeenCalledTimes(1);
    expect(mockUpsertSwipe).toHaveBeenCalledTimes(1);

    const writeArg = mockInsertOutboxItem.mock.calls[0][1];
    expect(writeArg.type).toBe("like");
    expect(writeArg.idempotencyKey).toBeTruthy();
    expect(writeArg.payload).toEqual({ profileId: "profile-1", direction: "like" });
  });

  it("calls attemptDrain after enqueue", async () => {
    await enqueueDecision("skip", "profile-2");
    expect(mockAttemptDrain).toHaveBeenCalledTimes(1);
  });
});

describe("undoDecision (REQUIREMENTS §4.1)", () => {
  it("deletes the outbox item + swipe if still queued (no-op for server)", async () => {
    const swipe = { outboxItemId: "item-1" };
    const item: OutboxItemRow = {
      id: "item-1",
      type: "like",
      payload: { profileId: "p1", direction: "like" },
      idempotencyKey: "k1",
      status: "queued",
      attempts: 0,
      nextAttemptAt: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockGetSwipe.mockResolvedValue(swipe);
    mockGetOutboxItem.mockResolvedValue(item);

    await undoDecision("p1");

    expect(mockDeleteOutboxItem).toHaveBeenCalledWith("fake-tx", "item-1");
    expect(mockDeleteSwipe).toHaveBeenCalledWith("fake-tx", "p1");
    expect(mockInsertOutboxItem).not.toHaveBeenCalled();
  });

  it("enqueues a compensating undoDecision when original already left the queue", async () => {
    const swipe = { outboxItemId: "item-1" };
    const item: OutboxItemRow = {
      id: "item-1",
      type: "like",
      payload: { profileId: "p1", direction: "like" },
      idempotencyKey: "k1",
      status: "done",
      attempts: 1,
      nextAttemptAt: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockGetSwipe.mockResolvedValue(swipe);
    mockGetOutboxItem.mockResolvedValue(item);

    await undoDecision("p1");

    expect(mockDeleteOutboxItem).not.toHaveBeenCalled();
    expect(mockInsertOutboxItem).toHaveBeenCalledTimes(1);
    const writeArg = mockInsertOutboxItem.mock.calls[0][1];
    expect(writeArg.type).toBe("undoDecision");
    expect(writeArg.payload).toEqual({ profileId: "p1" });
  });

  it("is a no-op when no swipe exists", async () => {
    mockGetSwipe.mockResolvedValue(undefined);
    await undoDecision("p1");
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockInsertOutboxItem).not.toHaveBeenCalled();
  });
});

describe("wipeLocalData", () => {
  it("deletes all outbox + mirror rows", async () => {
    await wipeLocalData();
    expect(mockDeleteAllOutboxItems).toHaveBeenCalled();
    expect(mockDeleteAllSwipes).toHaveBeenCalled();
    expect(mockDeleteAllMessages).toHaveBeenCalled();
    expect(mockDeleteAllMatches).toHaveBeenCalled();
    expect(mockDeleteAllShortlists).toHaveBeenCalled();
    expect(mockDeleteAllAppSettings).toHaveBeenCalled();
  });
});
