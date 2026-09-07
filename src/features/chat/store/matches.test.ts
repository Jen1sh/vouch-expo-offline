import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { renderHook, act } from "@testing-library/react-native";
import { useMatches, refreshMatches } from "@/src/features/chat/store/matches";
import type { MatchListItem } from "@/src/db/queries/matches.queries";

const fakeMatch: MatchListItem = {
  id: "m1",
  profileId: "p1",
  firstName: "A",
  lastName: "B",
  photoUri: "",
  verified: false,
  lastMessageBody: null,
  lastMessageSenderId: null,
  lastMessageAt: null,
  lastMessageStatus: null,
  unreadCount: 0,
  createdAt: 0,
};

const mockListMatches = jest.fn<() => Promise<MatchListItem[]>>();

jest.mock("@/src/db/queries/matches.queries", () => ({
  listMatches: () => mockListMatches(),
}));

beforeEach(() => {
  mockListMatches.mockClear();
  mockListMatches.mockResolvedValue([fakeMatch]);
});

describe("matches store", () => {
  it("useMatches returns empty array initially", () => {
    const { result } = renderHook(() => useMatches());
    expect(result.current).toEqual([]);
  });

  it("refreshMatches populates the store", async () => {
    const { result } = renderHook(() => useMatches());
    await act(async () => { await refreshMatches(); });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe("m1");
  });
});