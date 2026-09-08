import { jest, describe, it, expect, beforeEach } from "@jest/globals";

import { forceMatchEvent, forceIncomingMessage, simulateReciprocalLike, simulateTyping } from "@/src/realtime/realtimeChannel";

type MockEvent = {
  type: string;
  matchId: string;
  profileId: string;
  messageId: string;
  senderId: string;
  body: string;
  userId: string;
};

const mockEmit = jest.fn<(event: MockEvent) => void>();
const mockGetMatch = jest.fn<(matchId: string, client: unknown) => Promise<{ profileId: string } | undefined>>();
const mockReciprocates = jest.fn<(profileId: string) => boolean>(() => true);

jest.mock("@/src/db/client", () => ({ db: {} }));
jest.mock("@/src/db/queries/matches.queries", () => ({
  getMatch: (matchId: string, client: unknown) => mockGetMatch(matchId, client),
}));

jest.mock("@/src/mocks/partnerReply", () => ({
  nextIncomingLine: () => "Mock reply line",
}));

jest.mock("@/src/mocks/reciprocity", () => ({
  reciprocates: (id: string) => mockReciprocates(id),
  matchIdForProfile: (id: string) => `match-${id}`,
}));

jest.mock("@/src/mocks/seed/profiles", () => ({
  SEED_PROFILES: [
    { id: "demo-1", firstName: "Demo", lastName: "One" },
    { id: "demo-2", firstName: "Demo", lastName: "Two" },
    { id: "demo-3", firstName: "Demo", lastName: "Three" },
    { id: "seed-4", firstName: "Seed", lastName: "Four" },
    { id: "seed-5", firstName: "Seed", lastName: "Five" },
  ],
}));

jest.mock("@/src/realtime/publishes", () => ({
  emit: (event: unknown) => mockEmit(event as Parameters<typeof mockEmit>[0]),
  forceDuplicateEvent: jest.fn(),
  getLastEmittedEvent: jest.fn().mockReturnValue(null),
  nextId: (prefix: string) => `${prefix}-1`,
  subscribeToRealtime: jest.fn().mockReturnValue(() => {}),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockReciprocates.mockReturnValue(true);
});

describe("realtimeChannel (REQUIREMENTS §4.3/§4.5)", () => {
  it("forceMatchEvent emits a matches:new event for a seed profile (skipping demo)", () => {
    forceMatchEvent();

    expect(mockEmit).toHaveBeenCalledTimes(1);
    const call = mockEmit.mock.calls[0][0];
    expect(call.type).toBe("matches:new");
    expect(call.profileId).toBe("seed-4");
    expect(call.matchId).toBe("match-seed-4");
  });

  it("forceMatchEvent cycles through seed profiles on repeated calls", () => {
    forceMatchEvent();
    forceMatchEvent();

    expect(mockEmit).toHaveBeenCalledTimes(2);
    const ids = mockEmit.mock.calls.map((c) => c[0].profileId);
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids.every((id: string) => id.startsWith("seed-"))).toBe(true);
  });

  it("simulateReciprocalLike emits when reciprocated", () => {
    const result = simulateReciprocalLike("seed-4");
    expect(result).toBe(true);
    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit.mock.calls[0][0].type).toBe("matches:new");
  });

  it("simulateReciprocalLike stays silent when not reciprocated", () => {
    mockReciprocates.mockReturnValue(false);
    const result = simulateReciprocalLike("seed-4");
    expect(result).toBe(false);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("forceIncomingMessage emits a messages:new event with the match's partner", async () => {
    mockGetMatch.mockResolvedValue({ profileId: "p7" });
    await forceIncomingMessage("m1");

    expect(mockEmit).toHaveBeenCalledTimes(1);
    const call = mockEmit.mock.calls[0][0];
    expect(call.type).toBe("messages:new");
    expect(call.senderId).toBe("p7");
    expect(call.body).toBe("Mock reply line");
    expect(call.messageId).toMatch(/^manual-/);
  });

  it("forceIncomingMessage is a no-op when the match is missing", async () => {
    mockGetMatch.mockResolvedValue(undefined);
    await forceIncomingMessage("nope");
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("simulateTyping emits a typing event for the match's partner", async () => {
    mockGetMatch.mockResolvedValue({ profileId: "p7" });
    await simulateTyping("m1");

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit.mock.calls[0][0].userId).toBe("p7");
  });

  it("simulateTyping is a no-op when the match is missing", async () => {
    mockGetMatch.mockResolvedValue(undefined);
    await simulateTyping("nope");
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
