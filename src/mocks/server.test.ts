import { jest, describe, it, expect, beforeEach } from "@jest/globals";

import { request, NetworkOfflineError, WriteFailureError } from "@/src/mocks/server";

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

describe("simulated network layer (REQUIREMENTS §4.4)", () => {
  it("returns { ok: true } when online with no write failure", async () => {
    const result = await request({ path: "/api/like", method: "POST" });
    expect(result).toEqual({ ok: true });
  });

  it("rejects with NetworkOfflineError when offline", async () => {
    mockIsOffline.mockReturnValue(true);
    await expect(request({ path: "/api/like", method: "POST" })).rejects.toThrow(NetworkOfflineError);
  });

  it("rejects with WriteFailureError when write failure rolls", async () => {
    mockGetControls.mockReturnValue({
      offline: false,
      latencyMinMs: 0,
      latencyMaxMs: 0,
      writeFailureRate: 1,
      duplicateRate: 0,
      outOfOrderWindow: 0,
      autoReply: false,
    });
    await expect(request({ path: "/api/like", method: "POST" })).rejects.toThrow(WriteFailureError);
  });

  it("never fails GET requests due to write-failure rate", async () => {
    mockGetControls.mockReturnValue({
      offline: false,
      latencyMinMs: 0,
      latencyMaxMs: 0,
      writeFailureRate: 1,
      duplicateRate: 0,
      outOfOrderWindow: 0,
      autoReply: false,
    });
    const result = await request({ path: "/api/profiles", method: "GET" });
    expect(result).toEqual({ ok: true });
  });

  it("applies latency within the configured range", async () => {
    jest.useFakeTimers();
    mockGetControls.mockReturnValue({
      offline: false,
      latencyMinMs: 100,
      latencyMaxMs: 200,
      writeFailureRate: 0,
      duplicateRate: 0,
      outOfOrderWindow: 0,
      autoReply: false,
    });

    const promise = request({ path: "/api/like", method: "POST" });
    await jest.advanceTimersByTimeAsync(200);
    const result = await promise;
    expect(result).toEqual({ ok: true });
  });
});
