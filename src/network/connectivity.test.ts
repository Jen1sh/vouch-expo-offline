import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

import {
  getRealOnline,
  isOffline,
  subscribeOffline,
  useOffline,
  useRealOnline,
} from "@/src/network/connectivity";
import {
  resetDevPanelControls,
  setDevPanelControls,
} from "@/src/mocks/devPanelControls";

/**
 * Simulates a NetInfo state report by invoking the handler `connectivity`
 * module registered with the mocked NetInfo at import time. Returns the
 * handler so tests can drive real→offline transitions.
 */
function driveNetInfo(): (state: NetInfoState) => void {
  return jest.mocked(NetInfo.addEventListener).mock.calls[0][0];
}

const OFFLINE_STATE: NetInfoState = {
  type: "none",
  isConnected: false,
  isInternetReachable: false,
  details: null,
} as NetInfoState;

const ONLINE_STATE: NetInfoState = {
  type: "wifi",
  isConnected: true,
  isInternetReachable: true,
  details: { isConnectionExpensive: false },
} as NetInfoState;

beforeEach(() => {
  resetDevPanelControls();
  // `realOnline` is module-level and persists across tests in this file —
  // normalize to a known online state so no test inherits another's NetInfo.
  act(() => driveNetInfo()(ONLINE_STATE));
});

afterEach(() => {
  resetDevPanelControls();
});

describe("real connectivity", () => {
  it("starts online and only flips after a definite offline report", () => {
    expect(getRealOnline()).toBe(true);
    expect(isOffline()).toBe(false);
  });

  it("flips to offline when NetInfo reports no internet", () => {
    const report = driveNetInfo();
    act(() => report(OFFLINE_STATE));
    expect(getRealOnline()).toBe(false);
    expect(isOffline()).toBe(true);
  });

  it("treats an unknown internet reachability as still online", () => {
    const report = driveNetInfo();
    act(() => report({ ...ONLINE_STATE, isInternetReachable: null } as NetInfoState));
    expect(getRealOnline()).toBe(true);
  });

  it("recovers to online when connectivity returns", () => {
    const report = driveNetInfo();
    act(() => report(OFFLINE_STATE));
    act(() => report(ONLINE_STATE));
    expect(getRealOnline()).toBe(true);
    expect(isOffline()).toBe(false);
  });
});

describe("combined offline channel", () => {
  it("is offline when the manual toggle is on even with real connectivity", () => {
    act(() => driveNetInfo()(ONLINE_STATE));
    act(() => setDevPanelControls({ offline: true }));
    expect(isOffline()).toBe(true);
  });

  it("is online only when the toggle is off and real connectivity exists", () => {
    act(() => setDevPanelControls({ offline: false }));
    act(() => driveNetInfo()(ONLINE_STATE));
    expect(isOffline()).toBe(false);
  });

  it("stays offline when real connectivity is gone, regardless of the toggle", () => {
    act(() => driveNetInfo()(OFFLINE_STATE));
    act(() => setDevPanelControls({ offline: false }));
    expect(isOffline()).toBe(true);
  });
});

describe("hooks", () => {
  it("useRealOnline re-renders on NetInfo changes", () => {
    const { result } = renderHook(() => useRealOnline());
    expect(result.current).toBe(true);
    act(() => driveNetInfo()(OFFLINE_STATE));
    expect(result.current).toBe(false);
  });

  it("useOffline reads the manual toggle and real connectivity", () => {
    const { result } = renderHook(() => useOffline());
    expect(result.current).toBe(false);
    act(() => driveNetInfo()(OFFLINE_STATE));
    expect(result.current).toBe(true);
    act(() => driveNetInfo()(ONLINE_STATE));
    act(() => setDevPanelControls({ offline: true }));
    expect(result.current).toBe(true);
    act(() => setDevPanelControls({ offline: false }));
    expect(result.current).toBe(false);
  });
});

describe("subscribeOffline", () => {
  it("notifies on every offline/online transition", () => {
    const report = driveNetInfo();
    const listener = jest.fn();
    const unsubscribe = subscribeOffline(listener);
    try {
      act(() => report(OFFLINE_STATE));
      act(() => report(ONLINE_STATE));
      act(() => report(OFFLINE_STATE));
      expect(listener).toHaveBeenCalledTimes(3);
    } finally {
      unsubscribe();
    }
  });

  it("notifies when the manual toggle changes", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeOffline(listener);
    try {
      act(() => setDevPanelControls({ offline: true }));
      act(() => setDevPanelControls({ offline: false }));
      expect(listener).toHaveBeenCalledTimes(2);
    } finally {
      unsubscribe();
    }
  });
});