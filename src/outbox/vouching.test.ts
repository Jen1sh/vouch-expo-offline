import { jest, describe, it, expect, beforeEach } from "@jest/globals";

import { enqueueShortlist, removeShortlist, enqueueUpdateVouchNote } from "@/src/outbox/vouching";
import type { OutboxWrite } from "@/src/outbox/actions";

type ShortlistRowLike = { profileId: string; outboxItemId?: string | null };

const mockInsertOutboxItem = jest.fn<(tx: unknown, write: OutboxWrite) => Promise<void>>();
const mockGetOutboxItem = jest.fn<(tx: unknown, id: string) => Promise<{ id: string; status: string } | undefined>>();
const mockDeleteOutboxItem = jest.fn<(tx: unknown, id: string) => Promise<void>>();
const mockDeleteQueuedNoteUpdates = jest.fn<(tx: unknown, profileId: string) => Promise<void>>();
const mockGetShortlist = jest.fn<(tx: unknown, profileId: string) => Promise<ShortlistRowLike | undefined>>();
const mockInsertShortlist = jest.fn<(tx: unknown, row: unknown, at: Date) => Promise<void>>();
const mockDeleteShortlist = jest.fn<(tx: unknown, profileId: string) => Promise<void>>();
const mockUpsertShortlistNote = jest.fn<(tx: unknown, profileId: string, note: string, at: Date) => Promise<void>>();
const mockAttemptDrain = jest.fn<() => Promise<{ completed: number }>>().mockResolvedValue({ completed: 0 });
const mockEnsureMigrated = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockTransaction = jest.fn(async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> => cb("fake-tx"));
const mockGetModeSnapshot = jest.fn<() => string>(() => "voucher");

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
  deleteQueuedNoteUpdates: (tx: unknown, profileId: string) => mockDeleteQueuedNoteUpdates(tx, profileId),
}));

jest.mock("@/src/db/queries/shortlist.queries", () => ({
  getShortlist: (tx: unknown, profileId: string) => mockGetShortlist(tx, profileId),
  insertShortlist: (tx: unknown, row: unknown, at: Date) => mockInsertShortlist(tx, row, at),
  deleteShortlist: (tx: unknown, profileId: string) => mockDeleteShortlist(tx, profileId),
  upsertShortlistNote: (tx: unknown, profileId: string, note: string, at: Date) =>
    mockUpsertShortlistNote(tx, profileId, note, at),
}));

jest.mock("@/src/outbox/drain", () => ({
  attemptDrain: () => mockAttemptDrain(),
}));

jest.mock("@/src/store/mode/mode-snapshot", () => ({
  getModeSnapshot: () => mockGetModeSnapshot(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockAttemptDrain.mockResolvedValue({ completed: 0 });
  mockGetModeSnapshot.mockReturnValue("voucher");
});

describe("enqueueShortlist (REQUIREMENTS §3.7/§4.1)", () => {
  it("inserts outbox item + shortlist mirror atomically", async () => {
    mockGetShortlist.mockResolvedValue(undefined);
    await enqueueShortlist("profile-1");

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockInsertOutboxItem).toHaveBeenCalledTimes(1);
    expect(mockInsertShortlist).toHaveBeenCalledTimes(1);

    const writeArg = mockInsertOutboxItem.mock.calls[0][1];
    expect(writeArg.type).toBe("shortlist");
    expect(writeArg.idempotencyKey).toBeTruthy();
  });

  it("no-ops when already shortlisted", async () => {
    mockGetShortlist.mockResolvedValue({ profileId: "profile-1", outboxItemId: "item-1" });
    await enqueueShortlist("profile-1");
    expect(mockInsertOutboxItem).not.toHaveBeenCalled();
  });

  it("throws when not in voucher mode", async () => {
    mockGetModeSnapshot.mockReturnValue("member");
    await expect(enqueueShortlist("profile-1")).rejects.toThrow("voucher-mode action");
  });

  it("kicks the drain", async () => {
    mockGetShortlist.mockResolvedValue(undefined);
    await enqueueShortlist("profile-1");
    expect(mockAttemptDrain).toHaveBeenCalledTimes(1);
  });
});

describe("removeShortlist", () => {
  it("deletes the outbox item + shortlist if still queued", async () => {
    mockGetShortlist.mockResolvedValue({ profileId: "p1", outboxItemId: "item-1" });
    mockGetOutboxItem.mockResolvedValue({ id: "item-1", status: "queued" });

    await removeShortlist("p1");

    expect(mockDeleteShortlist).toHaveBeenCalledWith("fake-tx", "p1");
    expect(mockDeleteOutboxItem).toHaveBeenCalledWith("fake-tx", "item-1");
    expect(mockDeleteQueuedNoteUpdates).toHaveBeenCalledWith("fake-tx", "p1");
    expect(mockInsertOutboxItem).not.toHaveBeenCalled();
  });

  it("enqueues unshortlist when add already left the queue", async () => {
    mockGetShortlist.mockResolvedValue({ profileId: "p1", outboxItemId: "item-1" });
    mockGetOutboxItem.mockResolvedValue({ id: "item-1", status: "done" });

    await removeShortlist("p1");

    expect(mockDeleteOutboxItem).not.toHaveBeenCalled();
    expect(mockInsertOutboxItem).toHaveBeenCalledTimes(1);
    const writeArg = mockInsertOutboxItem.mock.calls[0][1];
    expect(writeArg.type).toBe("unshortlist");
  });

  it("is a no-op when not shortlisted", async () => {
    mockGetShortlist.mockResolvedValue(undefined);
    await removeShortlist("p1");
    expect(mockDeleteShortlist).not.toHaveBeenCalled();
  });

  it("throws when not in voucher mode", async () => {
    mockGetModeSnapshot.mockReturnValue("member");
    await expect(removeShortlist("p1")).rejects.toThrow("voucher-mode action");
  });
});

describe("enqueueUpdateVouchNote", () => {
  it("inserts outbox item + upserts note atomically", async () => {
    mockGetShortlist.mockResolvedValue({ profileId: "p1", outboxItemId: "item-1" });
    await enqueueUpdateVouchNote("p1", "great candidate");

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockInsertOutboxItem).toHaveBeenCalledTimes(1);
    expect(mockUpsertShortlistNote).toHaveBeenCalledTimes(1);

    const writeArg = mockInsertOutboxItem.mock.calls[0][1];
    expect(writeArg.type).toBe("updateVouchNote");
    expect(writeArg.payload).toEqual({ profileId: "p1", note: "great candidate" });
  });

  it("is a no-op when profile is not shortlisted", async () => {
    mockGetShortlist.mockResolvedValue(undefined);
    await enqueueUpdateVouchNote("p1", "note");
    expect(mockInsertOutboxItem).not.toHaveBeenCalled();
  });

  it("throws when not in voucher mode", async () => {
    mockGetModeSnapshot.mockReturnValue("member");
    await expect(enqueueUpdateVouchNote("p1", "note")).rejects.toThrow("voucher-mode action");
  });
});
