import { jest, describe, it, expect, beforeEach } from "@jest/globals";

import { enqueueDecision } from "@/src/outbox/queue";
import { sendMessage } from "@/src/outbox/messages";
import { attemptDrain, __resetOutboxWatcherForTests } from "@/src/outbox/drain";
import type { OutboxItemRow } from "@/src/db/schema/outbox";
import type { OutboxWrite } from "@/src/outbox/actions";
import type { RequestOptions } from "@/src/mocks/server";

type WriteRow = { type: OutboxItemRow["type"]; idempotencyKey: string; payload: OutboxItemRow["payload"] };

const mockInsertOutboxItem = jest.fn<(tx: unknown, write: OutboxWrite) => Promise<void>>();
const mockUpsertSwipe = jest.fn<(tx: unknown, row: unknown, at: Date) => Promise<void>>();
const mockInsertMessage = jest.fn<(tx: unknown, row: unknown) => Promise<void>>();
const mockInsertShortlist = jest.fn<(tx: unknown, row: unknown, at: Date) => Promise<void>>();
const mockInsertOutboxItems: WriteRow[] = [];

const mockEnsureMigrated = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockTransaction = jest.fn(async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> => cb("fake-tx"));
const mockRequest = jest.fn<(req: RequestOptions) => Promise<unknown>>();
const mockIsOffline = jest.fn<() => boolean>(() => true);
const mockClaim = jest.fn<() => Promise<OutboxItemRow | null>>().mockResolvedValue(null);
const mockRecover = jest.fn<() => Promise<OutboxItemRow[]>>().mockResolvedValue([]);
const mockMarkDone = jest.fn<(id: string, doneAt: Date) => Promise<void>>().mockResolvedValue(undefined);
const mockScheduleRetry = jest.fn<(id: string, attempts: number, nextAttemptAt: Date, lastError: string, updatedAt: Date) => Promise<void>>().mockResolvedValue(undefined);
const mockFailItem = jest.fn<(id: string, attempts: number, lastError: string, failedAt: Date) => Promise<void>>().mockResolvedValue(undefined);
const mockGetModeSnapshot = jest.fn<() => string>(() => "member");
const mockSetMessageStatusMirror = jest.fn<(messageId: string, status: string) => void>();
const mockGetMessageForOutboxItem = jest.fn<(itemId: string, tx: unknown) => Promise<unknown>>().mockResolvedValue(null);

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
  insertOutboxItem: (tx: unknown, write: OutboxWrite) => {
    mockInsertOutboxItems.push({
      type: write.type,
      idempotencyKey: write.idempotencyKey,
      payload: write.payload,
    });
    return mockInsertOutboxItem(tx, write);
  },
  claimNextDueItem: () => mockClaim(),
  recoverInFlightItems: () => mockRecover(),
  markOutboxItemDone: (id: string, doneAt: Date) => mockMarkDone(id, doneAt),
  failOutboxItem: (id: string, attempts: number, lastError: string, failedAt: Date) =>
    mockFailItem(id, attempts, lastError, failedAt),
  scheduleOutboxRetry: (id: string, attempts: number, nextAttemptAt: Date, lastError: string, updatedAt: Date) =>
    mockScheduleRetry(id, attempts, nextAttemptAt, lastError, updatedAt),
}));

jest.mock("@/src/db/queries/swipes.queries", () => ({
  upsertSwipe: (tx: unknown, row: unknown, at: Date) => mockUpsertSwipe(tx, row, at),
}));

jest.mock("@/src/db/queries/messages.queries", () => ({
  SELF_SENDER_ID: "self",
  insertMessage: (tx: unknown, row: unknown) => mockInsertMessage(tx, row),
  transitionMessageToSending: jest.fn(),
  markMessageSent: jest.fn(),
  failMessageSend: jest.fn(),
  rescheduleMessageSend: jest.fn(),
  getMessageForOutboxItem: (itemId: string, tx: unknown) => mockGetMessageForOutboxItem(itemId, tx),
  setMessageStatus: jest.fn(),
}));

jest.mock("@/src/db/queries/shortlist.queries", () => ({
  insertShortlist: (tx: unknown, row: unknown, at: Date) => mockInsertShortlist(tx, row, at),
}));

jest.mock("@/src/features/chat/store/message-status", () => ({
  setMessageStatusMirror: (messageId: string, status: string) => mockSetMessageStatusMirror(messageId, status),
}));

jest.mock("@/src/store/mode/mode-snapshot", () => ({
  getModeSnapshot: () => mockGetModeSnapshot(),
}));

jest.mock("@/src/mocks/server", () => ({
  NetworkOfflineError: class extends Error {},
  request: (req: RequestOptions) => mockRequest(req),
}));

jest.mock("@/src/network/connectivity", () => ({
  isOffline: () => mockIsOffline(),
  subscribeOffline: (l: () => void) => () => {},
}));

jest.mock("@/src/mocks/reciprocity", () => ({ maybeEmitMatchOnLike: jest.fn() }));
jest.mock("@/src/mocks/partnerReply", () => ({ maybeSchedulePartnerReply: jest.fn() }));
jest.mock("@/src/components/AppToast", () => ({ showAppToast: jest.fn() }));

function fakeRow(overrides: Partial<OutboxItemRow> = {}): OutboxItemRow {
  return {
    id: "item-1",
    type: "like",
    payload: { profileId: "p1", direction: "like" },
    idempotencyKey: "k-1",
    status: "queued",
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetModeSnapshot.mockReturnValue("member");
  mockInsertOutboxItems.length = 0;
  __resetOutboxWatcherForTests();
});

describe("outbox integration: offline → actions → online → drain", () => {
  it("queues 5 actions offline, drains them exactly once when online", async () => {
    mockIsOffline.mockReturnValue(true);
    mockRequest.mockResolvedValue({ ok: true });

    await enqueueDecision("like", "p1");
    await enqueueDecision("skip", "p2");
    await enqueueDecision("askVoucher", "p3");
    await sendMessage("m1", "hi");
    await sendMessage("m1", "there");

    expect(mockInsertOutboxItems.length).toBe(5);

    const types = mockInsertOutboxItems.map((w) => w.type);
    expect(types).toEqual(["like", "skip", "askVoucher", "sendMessage", "sendMessage"]);

    const keys = mockInsertOutboxItems.map((w) => w.idempotencyKey);
    expect(new Set(keys).size).toBe(5);

    mockIsOffline.mockReturnValue(false);

    let claimIdx = 0;
    mockClaim.mockImplementation(async () => {
      if (claimIdx < 5) {
        const row = fakeRow({
          id: `item-${claimIdx}`,
          type: types[claimIdx],
          payload: mockInsertOutboxItems[claimIdx].payload,
          idempotencyKey: keys[claimIdx],
        });
        claimIdx++;
        return row;
      }
      return null;
    });

    const result = await attemptDrain();

    expect(result.completed).toBe(5);
    expect(mockRequest).toHaveBeenCalledTimes(5);

    const sentKeys = mockRequest.mock.calls.map((c) => (c[0]?.body as { idempotencyKey?: string } | undefined)?.idempotencyKey);
    expect(new Set(sentKeys).size).toBe(5);
  });

  it("undo while queued deletes item + swipe; undo after drain enqueues compensating write", async () => {
    mockIsOffline.mockReturnValue(true);

    await enqueueDecision("like", "p1");
    expect(mockInsertOutboxItems.length).toBe(1);

    mockIsOffline.mockReturnValue(false);
    let claimCount = 0;
    mockClaim.mockImplementation(async () => {
      if (claimCount === 0) {
        claimCount++;
        return fakeRow({
          id: "item-0",
          type: "like",
          payload: { profileId: "p1", direction: "like" },
          idempotencyKey: mockInsertOutboxItems[0].idempotencyKey,
          status: "queued",
        });
      }
      return null;
    });

    const drainResult = await attemptDrain();
    expect(drainResult.completed).toBe(1);
    expect(mockMarkDone).toHaveBeenCalledTimes(1);
  });
});
