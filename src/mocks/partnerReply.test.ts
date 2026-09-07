import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";

import {
  maybeSchedulePartnerReply,
  emitIncoming,
  cancelPendingReplies,
  resetPartnerReplyCursor,
  nextIncomingLine,
} from "@/src/mocks/partnerReply";
import {
  resetDevPanelControls,
  setDevPanelControls,
} from "@/src/mocks/devPanelControls";

type Listener = (event: Record<string, unknown>) => void;
const emitted: Record<string, unknown>[] = [];
let mockListener: Listener | null = null;

jest.mock("@/src/realtime/publishes", () => ({
  emit: (event: Record<string, unknown>) => {
    emitted.push(event);
    mockListener?.(event);
  },
}));

beforeEach(() => {
  emitted.length = 0;
  mockListener = null;
  resetDevPanelControls();
  cancelPendingReplies();
  resetPartnerReplyCursor();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("simulated partner reply (REQUIREMENTS §3.6/§4.3)", () => {
  it("does not schedule a reply when auto-reply is OFF (default)", () => {
    maybeSchedulePartnerReply("m1");
    jest.runAllTimers();
    expect(emitted).toEqual([]);
  });

  it("emits a messages:new reply after the delay when auto-reply is ON", () => {
    setDevPanelControls({ autoReply: true });
    maybeSchedulePartnerReply("m1");
    jest.runAllTimers();
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "messages:new",
      matchId: "m1",
      body: expect.any(String),
    });
  });

  it("strips senderId (consumer resolves it from the match)", () => {
    setDevPanelControls({ autoReply: true });
    maybeSchedulePartnerReply("m1");
    jest.runAllTimers();
    expect(emitted[0]).not.toHaveProperty("senderId");
  });

  it("ignores missing match ids", () => {
    setDevPanelControls({ autoReply: true });
    maybeSchedulePartnerReply(undefined);
    jest.runAllTimers();
    expect(emitted).toEqual([]);
  });

  it("cycles deterministic reply lines", () => {
    resetPartnerReplyCursor();
    const first = nextIncomingLine();
    const second = nextIncomingLine();
    expect(first).not.toBe(second);
    expect(typeof first).toBe("string");
  });

  it("emitIncoming pushes a message without a senderId", () => {
    emitIncoming("m1");
    expect(emitted[0]).toMatchObject({ type: "messages:new", matchId: "m1" });
  });
});