import { describe, expect, it, jest } from "@jest/globals";

import { newIdempotencyKey, toPayload } from "@/src/outbox/actions";

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "test-uuid-1234"),
}));

describe("outbox actions (REQUIREMENTS §4.1)", () => {
  it("newIdempotencyKey returns a string", () => {
    const key = newIdempotencyKey();
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
  });

  describe("toPayload", () => {
    it("maps like/skip/askVoucher to { profileId, direction }", () => {
      expect(toPayload({ type: "like", profileId: "p1" })).toEqual({ profileId: "p1", direction: "like" });
      expect(toPayload({ type: "skip", profileId: "p2" })).toEqual({ profileId: "p2", direction: "skip" });
      expect(toPayload({ type: "askVoucher", profileId: "p3" })).toEqual({ profileId: "p3", direction: "askVoucher" });
    });

    it("maps undoDecision/shortlist/unshortlist to { profileId }", () => {
      expect(toPayload({ type: "undoDecision", profileId: "p1" })).toEqual({ profileId: "p1" });
      expect(toPayload({ type: "shortlist", profileId: "p1" })).toEqual({ profileId: "p1" });
      expect(toPayload({ type: "unshortlist", profileId: "p1" })).toEqual({ profileId: "p1" });
    });

    it("maps sendMessage to { matchId, messageId, body }", () => {
      expect(
        toPayload({ type: "sendMessage", matchId: "m1", messageId: "msg1", body: "hi" })
      ).toEqual({ matchId: "m1", messageId: "msg1", body: "hi" });
    });

    it("maps updateVouchNote to { profileId, note }", () => {
      expect(toPayload({ type: "updateVouchNote", profileId: "p1", note: "great candidate" })).toEqual({
        profileId: "p1",
        note: "great candidate",
      });
    });
  });
});
