import { jest, describe, it, expect, beforeEach } from "@jest/globals";

import {
  startChatRealtime,
  __resetChatRealtimeForTests,
} from "@/src/features/chat/realtime/chatRealtime";

type Listener = (event: Record<string, unknown>) => void;

const mockSubscribe = jest.fn<(handler: Listener) => void>();
const mockEnsureMigrated = jest.fn<() => Promise<void>>();
const mockSeedChat = jest.fn<() => Promise<void>>();
const mockGetMatch = jest.fn<(db: unknown, matchId: string) => Promise<{ id: string; profileId: string } | null>>();
const mockUpsertMatch = jest.fn<(db: unknown, input: Record<string, unknown>) => Promise<void>>();
const mockGetMessage = jest.fn<(db: unknown, messageId: string) => Promise<{ id: string } | null>>();
const mockInsertMessage = jest.fn<(db: unknown, input: Record<string, unknown>) => Promise<void>>();
const mockRefreshMatches = jest.fn<() => Promise<void>>();
const mockNoteThreadChanged = jest.fn<(matchId: string) => void>();
const mockBeginTyping = jest.fn<(matchId: string) => void>();

jest.mock("@/src/db/client", () => ({ db: {} }));
jest.mock("@/src/db/migrate", () => ({ ensureMigrated: () => mockEnsureMigrated() }));
jest.mock("@/src/db/queries/chat.queries", () => ({ seedChatIfEmpty: () => mockSeedChat() }));
jest.mock("@/src/db/queries/matches.queries", () => ({
  getMatch: (db: unknown, matchId: string) => mockGetMatch(db, matchId),
  upsertMatch: (db: unknown, input: Record<string, unknown>) => mockUpsertMatch(db, input),
}));
jest.mock("@/src/db/queries/messages.queries", () => ({
  getMessage: (db: unknown, messageId: string) => mockGetMessage(db, messageId),
  insertMessage: (db: unknown, input: Record<string, unknown>) => mockInsertMessage(db, input),
}));
jest.mock("@/src/features/chat/store/matches", () => ({ refreshMatches: () => mockRefreshMatches() }));
jest.mock("@/src/features/chat/store/thread-revision", () => ({ noteThreadChanged: (matchId: string) => mockNoteThreadChanged(matchId) }));
jest.mock("@/src/features/chat/store/typing", () => ({ beginTyping: (matchId: string) => mockBeginTyping(matchId) }));
jest.mock("@/src/realtime/realtimeChannel", () => ({
  subscribeToRealtime: (handler: Listener) => {
    mockSubscribe(handler);
    return () => {};
  },
}));
// Real module-level dedupes are keyed by event.id; replayed ids are dropped.
jest.mock("@/src/realtime/dedupe", () => {
  return {
    createEventDedupe: () => {
      const seen = new Set<string>();
      return {
        accept: (event: { id: string }) => {
          if (seen.has(event.id)) {
            return false;
          }
          seen.add(event.id);
          return true;
        },
      };
    },
  };
});

let listener: Listener;

beforeEach(() => {
  mockSubscribe.mockClear();
  mockEnsureMigrated.mockClear().mockResolvedValue(undefined);
  mockSeedChat.mockClear().mockResolvedValue(undefined);
  mockGetMatch.mockClear().mockResolvedValue(null);
  mockUpsertMatch.mockClear().mockResolvedValue(undefined);
  mockGetMessage.mockClear().mockResolvedValue(null);
  mockInsertMessage.mockClear().mockResolvedValue(undefined);
  mockRefreshMatches.mockClear().mockResolvedValue(undefined);
  mockNoteThreadChanged.mockClear();
  mockBeginTyping.mockClear();
  __resetChatRealtimeForTests();
});

/** Starts a fresh instance and captures its realtime handler. */
function startAndCapture(): void {
  startChatRealtime();
  const calls = mockSubscribe.mock.calls as [Listener][];
  listener = calls[0][0];
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("chatRealtime reconciliation (REQUIREMENTS §4.3)", () => {
  it("subscribes once (idempotent) and pre-seeds", async () => {
    startChatRealtime();
    startChatRealtime();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    await flush();
    expect(mockSeedChat).toHaveBeenCalled();
  });

  it("reconciles a matches:new event into the matches mirror", async () => {
    startAndCapture();
    await flush();
    listener({ id: "e1", type: "matches:new", matchId: "m1", profileId: "p1", occurredAt: 123 });
    await flush();
    expect(mockUpsertMatch).toHaveBeenCalledWith({}, expect.objectContaining({ id: "m1", profileId: "p1" }));
    expect(mockRefreshMatches).toHaveBeenCalled();
  });

  it("skips an optimistic echo (row already exists)", async () => {
    mockGetMessage.mockResolvedValue({ id: "msg-1" });
    startAndCapture();
    await flush();
    listener({ id: "e2", type: "messages:new", matchId: "m1", messageId: "msg-1", body: "hi", senderId: "p1" });
    await flush();
    expect(mockInsertMessage).not.toHaveBeenCalled();
  });

  it("inserts an incoming message, resolving the sender from the match", async () => {
    mockGetMatch.mockResolvedValue({ id: "m1", profileId: "p1" });
    startAndCapture();
    await flush();
    listener({ id: "e3", type: "messages:new", matchId: "m1", messageId: "server-1", body: "hey" });
    await flush();
    expect(mockInsertMessage).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ senderId: "p1", body: "hey", status: "sent" })
    );
    expect(mockNoteThreadChanged).toHaveBeenCalledWith("m1");
  });

  it("drops an incoming message for an unknown match", async () => {
    mockGetMatch.mockResolvedValue(null);
    startAndCapture();
    await flush();
    listener({ id: "e4", type: "messages:new", matchId: "nope", messageId: "server-2", body: "hi", senderId: "p9" });
    await flush();
    expect(mockGetMatch).toHaveBeenCalledWith(expect.anything(), "nope");
    expect(mockInsertMessage).not.toHaveBeenCalled();
  });

  it("routes typing events into the typing store", async () => {
    startAndCapture();
    await flush();
    listener({ id: "e5", type: "typing", matchId: "m1", userId: "p1" });
    await flush();
    expect(mockBeginTyping).toHaveBeenCalledWith("m1");
  });

  it("dedupes a replayed event id so the DB write happens once", async () => {
    mockGetMatch.mockResolvedValue({ id: "m1", profileId: "p1" });
    startAndCapture();
    await flush();
    const event = { id: "e-dup", type: "messages:new", matchId: "m1", messageId: "server-dup", body: "hi" };
    listener(event);
    listener(event); // realtime duplicate-rate replay
    await flush();
    expect(mockInsertMessage).toHaveBeenCalledTimes(1);
  });
});