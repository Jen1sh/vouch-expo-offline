import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";

import {
  attemptDrain,
  startOutboxWatcher,
  __resetOutboxWatcherForTests,
} from "@/src/outbox/drain";
import { exceedsAttemptCap, MAX_OUTBOX_ATTEMPTS } from "@/src/outbox/backoff";
import { NetworkOfflineError } from "@/src/mocks/server";
import type { OutboxItemRow } from "@/src/db/schema/outbox";

const mockEnsureMigrated = jest.fn<() => Promise<void>>();
const mockClaim = jest.fn<() => Promise<OutboxItemRow | null>>();
const mockRecover = jest.fn<() => Promise<OutboxItemRow[]>>();
const mockMarkDone = jest.fn<(id: string, doneAt: Date) => Promise<void>>();
const mockFailItem = jest.fn<(id: string, attempts: number, lastError: string, failedAt: Date) => Promise<void>>();
const mockScheduleRetry = jest.fn<(id: string, attempts: number, nextAttemptAt: Date, lastError: string, updatedAt: Date) => Promise<void>>();
const mockGetMessage = jest.fn<(id: string, tx: unknown) => Promise<{ id: string } | null>>();
const mockTransitionSending = jest.fn<(tx: unknown, id: string, at: Date) => Promise<void>>();
const mockMarkMessageSent = jest.fn<(itemId: string, messageId: string, at: Date) => Promise<void>>();
const mockFailMessageSend = jest.fn<(itemId: string, messageId: string, attempts: number, lastError: string, at: Date) => Promise<void>>();
const mockRescheduleMessageSend = jest.fn<(itemId: string, messageId: string, update: { attempts: number; nextAttemptAt: Date }, lastError: string, at: Date) => Promise<void>>();
const mockSetMessageStatus = jest.fn<(client: unknown, messageId: string, status: string, at: Date) => Promise<void>>();
const mockSetMessageStatusMirror = jest.fn<(messageId: string, status: string) => void>();
const mockEmitMatch = jest.fn<(profileId: string) => void>();
const mockSchedulePartnerReply = jest.fn<(matchId: string) => void>();
const mockToast = jest.fn<(type: string, text1: string) => void>();
const mockRequest = jest.fn<() => Promise<unknown>>();
const mockIsOffline = jest.fn<() => boolean>();
const mockSubscribeOffline = jest.fn<(listener: () => void) => () => void>();

jest.mock("@/src/db/client", () => ({ db: {} }));
jest.mock("@/src/db/migrate", () => ({ ensureMigrated: () => mockEnsureMigrated() }));
jest.mock("@/src/db/queries/outbox.queries", () => ({
  claimNextDueItem: () => mockClaim(),
  recoverInFlightItems: () => mockRecover(),
  markOutboxItemDone: (id: string, doneAt: Date) => mockMarkDone(id, doneAt),
  failOutboxItem: (id: string, attempts: number, lastError: string, failedAt: Date) =>
    mockFailItem(id, attempts, lastError, failedAt),
  scheduleOutboxRetry: (id: string, attempts: number, nextAttemptAt: Date, lastError: string, updatedAt: Date) =>
    mockScheduleRetry(id, attempts, nextAttemptAt, lastError, updatedAt),
}));
jest.mock("@/src/db/queries/messages.queries", () => ({
  failMessageSend: (itemId: string, messageId: string, attempts: number, lastError: string, at: Date) =>
    mockFailMessageSend(itemId, messageId, attempts, lastError, at),
  getMessageForOutboxItem: (id: string, tx: unknown) => mockGetMessage(id, tx),
  markMessageSent: (itemId: string, messageId: string, at: Date) => mockMarkMessageSent(itemId, messageId, at),
  rescheduleMessageSend: (itemId: string, messageId: string, update: { attempts: number; nextAttemptAt: Date }, lastError: string, at: Date) =>
    mockRescheduleMessageSend(itemId, messageId, update, lastError, at),
  setMessageStatus: (client: unknown, messageId: string, status: string, at: Date) =>
    mockSetMessageStatus(client, messageId, status, at),
  transitionMessageToSending: (tx: unknown, id: string, at: Date) => mockTransitionSending(tx, id, at),
}));
jest.mock("@/src/features/chat/store/message-status", () => ({
  setMessageStatusMirror: (messageId: string, status: string) => mockSetMessageStatusMirror(messageId, status),
}));
jest.mock("@/src/mocks/reciprocity", () => ({ maybeEmitMatchOnLike: (profileId: string) => mockEmitMatch(profileId) }));
jest.mock("@/src/mocks/partnerReply", () => ({ maybeSchedulePartnerReply: (matchId: string) => mockSchedulePartnerReply(matchId) }));
jest.mock("@/src/components/AppToast", () => ({ showAppToast: (type: string, text1: string) => mockToast(type, text1) }));
jest.mock("@/src/network/connectivity", () => ({
  isOffline: () => mockIsOffline(),
  subscribeOffline: (listener: () => void) => mockSubscribeOffline(listener),
}));
jest.mock("@/src/mocks/server", () => {
  class NetworkOfflineError extends Error {}
  return {
    NetworkOfflineError,
    request: () => mockRequest(),
  };
});

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

function claimQueue(rows: (OutboxItemRow | null)[]): void {
  mockClaim.mockImplementation(async () => rows.shift() ?? null);
}

beforeEach(() => {
  mockEnsureMigrated.mockClear().mockResolvedValue(undefined);
  mockClaim.mockClear().mockResolvedValue(null);
  mockRecover.mockClear().mockResolvedValue([]);
  mockMarkDone.mockClear().mockResolvedValue(undefined);
  mockFailItem.mockClear().mockResolvedValue(undefined);
  mockScheduleRetry.mockClear().mockResolvedValue(undefined);
  mockGetMessage.mockClear().mockResolvedValue(null);
  mockTransitionSending.mockClear().mockResolvedValue(undefined);
  mockMarkMessageSent.mockClear().mockResolvedValue(undefined);
  mockFailMessageSend.mockClear().mockResolvedValue(undefined);
  mockRescheduleMessageSend.mockClear().mockResolvedValue(undefined);
  mockSetMessageStatus.mockClear().mockResolvedValue(undefined);
  mockSetMessageStatusMirror.mockClear();
  mockEmitMatch.mockClear();
  mockSchedulePartnerReply.mockClear();
  mockToast.mockClear();
  mockRequest.mockClear().mockResolvedValue(undefined);
  mockIsOffline.mockClear().mockReturnValue(false);
  mockSubscribeOffline.mockClear().mockReturnValue(() => {});
  __resetOutboxWatcherForTests();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("outbox drain (REQUIREMENTS §4.1, §4.7-2)", () => {
  it("recovers items a hard kill left `sending` before claiming anything", async () => {
    const stranded = fakeRow({
      id: "stranded-1",
      type: "sendMessage",
      payload: { matchId: "m1", messageId: "msg-1", body: "hi" },
      status: "sending",
    });
    mockRecover.mockResolvedValue([stranded]);
    claimQueue([stranded, null]);

    const result = await attemptDrain();

    expect(result.completed).toBe(1);
    expect(mockSetMessageStatus).toHaveBeenCalledWith(expect.anything(), "msg-1", "queued", expect.any(Date));
    expect(mockMarkMessageSent).toHaveBeenCalledTimes(1);
    const recoverOrder = mockRecover.mock.invocationCallOrder[0];
    const claimOrder = mockClaim.mock.invocationCallOrder[0];
    expect(recoverOrder).toBeLessThan(claimOrder);
    expect(mockSetMessageStatusMirror).toHaveBeenNthCalledWith(1, "msg-1", "queued");
    expect(mockSetMessageStatusMirror).toHaveBeenCalledWith("msg-1", "sent");
  });

  it("pauses while offline and delivers exactly once when connectivity returns", async () => {
    const like = fakeRow({ id: "like-1" });
    mockIsOffline.mockReturnValue(true);
    mockRequest.mockRejectedValueOnce(new NetworkOfflineError());
    claimQueue([like, like, null]);

    await attemptDrain({ notify: true });
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockMarkDone).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();

    mockIsOffline.mockReturnValue(false);
    const result = await attemptDrain();
    expect(result.completed).toBe(1);
    expect(mockMarkDone).toHaveBeenCalledTimes(1);
    expect(mockMarkDone).toHaveBeenCalledWith("like-1", expect.any(Date));
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it("delivers every claimable item exactly once, in claim order", async () => {
    const a = fakeRow({ id: "a", type: "like" });
    const b = fakeRow({ id: "b", type: "skip" });
    const c = fakeRow({ id: "c", type: "askVoucher" });
    const claimed: string[] = [];
    mockClaim.mockImplementation(async () => {
      if (claimed.length === 0) {
        claimed.push("a");
        return a;
      }
      if (claimed.length === 1) {
        claimed.push("b");
        return b;
      }
      if (claimed.length === 2) {
        claimed.push("c");
        return c;
      }
      return null;
    });

    const result = await attemptDrain();

    expect(result.completed).toBe(3);
    expect(claimed).toEqual(["a", "b", "c"]);
    expect(mockRequest).toHaveBeenCalledTimes(3);
    expect(mockMarkDone).toHaveBeenCalledTimes(3);
  });

  it("stops at the first backoff so a later item can never overtake an earlier one", async () => {
    jest.useFakeTimers();
    const a = fakeRow({ id: "a", attempts: 2 });
    const b = fakeRow({ id: "b" });
    claimQueue([a, b, null]);
    mockRequest.mockRejectedValueOnce(new Error("5xx"));

    const result = await attemptDrain();

    expect(result.completed).toBe(0);
    expect(mockScheduleRetry).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockClaim).toHaveBeenCalledTimes(1); // b never claimed — FIFO preserved
    jest.clearAllTimers();
  });

  it("permanently fails an item past the retry cap and keeps the loop moving", async () => {
    const failing = fakeRow({ id: "failing", attempts: MAX_OUTBOX_ATTEMPTS - 1 });
    const next = fakeRow({ id: "next" });
    claimQueue([failing, next, null]);
    mockRequest.mockRejectedValueOnce(new Error("5xx"));

    const result = await attemptDrain();

    expect(exceedsAttemptCap(MAX_OUTBOX_ATTEMPTS)).toBe(true);
    expect(mockFailItem).toHaveBeenCalledTimes(1);
    expect(mockFailItem).toHaveBeenCalledWith("failing", MAX_OUTBOX_ATTEMPTS, expect.any(String), expect.any(Date));
    expect(mockMarkDone).toHaveBeenCalledTimes(1); // loop continued to `next`
    expect(result.completed).toBe(1);
  });

  it("toasts only notified lifecycle runs that actually flushed items", async () => {
    claimQueue([fakeRow({ id: "t-1" }), null]);
    const notified = await attemptDrain({ notify: true });
    expect(notified.completed).toBe(1);
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith("success", "Synced 1 queued action");

    mockToast.mockClear();
    const silent = await attemptDrain();
    expect(silent.completed).toBe(0);
    expect(mockToast).not.toHaveBeenCalled();

    claimQueue([fakeRow({ id: "t-2" }), fakeRow({ id: "t-3" }), null]);
    await attemptDrain({ notify: true });
    expect(mockToast).toHaveBeenLastCalledWith("success", "Synced 2 queued actions");
  });

  it("boot drain self-heals: a rejected run chain-retries on the wake timer until it succeeds", async () => {
    jest.useFakeTimers();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockEnsureMigrated
      .mockRejectedValueOnce(new Error("cold-start migration hiccup"))
      .mockResolvedValue(undefined);

    startOutboxWatcher();
    startOutboxWatcher(); // idempotent — second call is a no-op

    await jest.advanceTimersByTimeAsync(0);
    expect(mockEnsureMigrated).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[outbox] drain attempt failed; will retry:", expect.any(Error));

    await jest.advanceTimersByTimeAsync(31_000);
    expect(mockEnsureMigrated).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(31_000);
    expect(mockEnsureMigrated).toHaveBeenCalledTimes(2); // succeeded — no further retries

    warn.mockRestore();
    jest.clearAllTimers();
  });
});