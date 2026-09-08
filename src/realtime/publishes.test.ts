import { jest, describe, it, expect, beforeEach } from "@jest/globals";

import {
  emit,
  subscribeToRealtime,
  forceDuplicateEvent,
  getLastEmittedEvent,
  nextId,
  type RealtimeEvent,
} from "@/src/realtime/publishes";

function listenerForAssertions() {
  return jest.fn<(event: RealtimeEvent) => void>();
}

const mockIsOffline = jest.fn(() => false);
const mockGetControls = jest.fn(() => ({
  offline: false,
  latencyMinMs: 300,
  latencyMaxMs: 300,
  writeFailureRate: 0,
  duplicateRate: 0,
  outOfOrderWindow: 0,
  autoReply: false,
}));

jest.mock("@/src/network/connectivity", () => ({
  isOffline: () => mockIsOffline(),
}));

jest.mock("@/src/mocks/devPanelControls", () => ({
  getControlsSnapshot: () => mockGetControls(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockIsOffline.mockReturnValue(false);
  mockGetControls.mockReturnValue({
    offline: false,
    latencyMinMs: 0,
    latencyMaxMs: 0,
    writeFailureRate: 0,
    duplicateRate: 0,
    outOfOrderWindow: 0,
    autoReply: false,
  });
});

describe("realtime publishes (REQUIREMENTS §4.3)", () => {
  it("nextId generates unique ids with the given prefix", () => {
    const id1 = nextId("test");
    const id2 = nextId("test");
    expect(id1).toMatch(/^test-/);
    expect(id1).not.toBe(id2);
  });

  it("delivers a matching-new event to subscribers", async () => {
    jest.useFakeTimers();
    const listener = listenerForAssertions();
    subscribeToRealtime(listener);

    emit({ type: "matches:new", matchId: "m1", profileId: "p1" });
    await jest.advanceTimersByTimeAsync(0);

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0];
    if (event.type !== "matches:new") {
      throw new Error(`expected matches:new, got ${event.type}`);
    }
    expect(event.matchId).toBe("m1");
    expect(event.profileId).toBe("p1");
  });

  it("delivers a messages:new event with body", async () => {
    jest.useFakeTimers();
    const listener = listenerForAssertions();
    subscribeToRealtime(listener);

    emit({ type: "messages:new", matchId: "m1", messageId: "msg1", body: "hello" });
    await jest.advanceTimersByTimeAsync(0);

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0];
    if (event.type !== "messages:new") {
      throw new Error(`expected messages:new, got ${event.type}`);
    }
    expect(event.body).toBe("hello");
  });

  it("delivers a typing event", async () => {
    jest.useFakeTimers();
    const listener = listenerForAssertions();
    subscribeToRealtime(listener);

    emit({ type: "typing", matchId: "m1", userId: "u1" });
    await jest.advanceTimersByTimeAsync(0);

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0];
    if (event.type !== "typing") {
      throw new Error(`expected typing, got ${event.type}`);
    }
    expect(event.userId).toBe("u1");
  });

  it("delivers a profiles:updated event", async () => {
    jest.useFakeTimers();
    const listener = listenerForAssertions();
    subscribeToRealtime(listener);

    emit({ type: "profiles:updated", userId: "u9" });
    await jest.advanceTimersByTimeAsync(0);

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0];
    if (event.type !== "profiles:updated") {
      throw new Error(`expected profiles:updated, got ${event.type}`);
    }
    expect(event.userId).toBe("u9");
  });

  it("re-emits the event once on a duplicate roll", async () => {
    jest.useFakeTimers();
    mockGetControls.mockReturnValue({
      offline: false,
      latencyMinMs: 0,
      latencyMaxMs: 0,
      writeFailureRate: 0,
      duplicateRate: 1,
      outOfOrderWindow: 0,
      autoReply: false,
    });
    const listener = listenerForAssertions();
    subscribeToRealtime(listener);

    emit({ type: "matches:new", matchId: "m1", profileId: "p1" });
    await jest.advanceTimersByTimeAsync(1);

    expect(listener).toHaveBeenCalledTimes(2);
    const first = listener.mock.calls[0][0];
    const second = listener.mock.calls[1][0];
    expect(second.id).toBe(first.id);
  });

  it("drops events while offline", async () => {
    jest.useFakeTimers();
    mockIsOffline.mockReturnValue(true);
    const listener = listenerForAssertions();
    subscribeToRealtime(listener);

    emit({ type: "matches:new", matchId: "m1", profileId: "p1" });
    await jest.advanceTimersByTimeAsync(0);

    expect(listener).not.toHaveBeenCalled();
  });

  it("deduplicates via forceDuplicateEvent", async () => {
    jest.useFakeTimers();
    const listener = listenerForAssertions();
    subscribeToRealtime(listener);

    emit({ type: "matches:new", matchId: "m1", profileId: "p1" });
    await jest.advanceTimersByTimeAsync(0);
    expect(listener).toHaveBeenCalledTimes(1);

    forceDuplicateEvent();
    expect(listener).toHaveBeenCalledTimes(2);
    const duplicate = listener.mock.calls[1][0];
    if (duplicate.type !== "matches:new") {
      throw new Error(`expected matches:new, got ${duplicate.type}`);
    }
    expect(duplicate.matchId).toBe("m1");
  });

  it("getLastEmittedEvent returns the most recent event", async () => {
    jest.useFakeTimers();

    emit({ type: "typing", matchId: "m1", userId: "u1" });
    await jest.advanceTimersByTimeAsync(0);

    const last = getLastEmittedEvent();
    expect(last).not.toBeNull();
    expect(last!.type).toBe("typing");
  });

  it("unsubscribe stops delivery", async () => {
    jest.useFakeTimers();
    const listener = listenerForAssertions();
    const unsub = subscribeToRealtime(listener);

    emit({ type: "typing", matchId: "m1", userId: "u1" });
    await jest.advanceTimersByTimeAsync(0);
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    emit({ type: "typing", matchId: "m1", userId: "u1" });
    await jest.advanceTimersByTimeAsync(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("throws on an unsupported event type", () => {
    const bogus = { type: "bogus" } as unknown as Parameters<typeof emit>[0];
    expect(() => emit(bogus)).toThrow("Unreachable event type");
  });
});
