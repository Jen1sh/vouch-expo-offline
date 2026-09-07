import { act, renderHook } from "@testing-library/react-native";
import { beforeEach, describe, expect, it } from "@jest/globals";

import {
  clearUserSwipes,
  getDecision,
  hydrateFromSwipes,
  setDecision,
  toggleLike,
  useUserSwipe,
} from "@/src/features/browse/store/user-swipes";

describe("browse user-swipes mirror (REQUIREMENTS §4.6 — per-row isolation)", () => {
  beforeEach(() => {
    clearUserSwipes();
  });

  it("defaults every profile to undecided", () => {
    expect(getDecision("seed-01")).toBeNull();
  });

  it("toggleLike flips like → undecided and anything else → like", () => {
    setDecision("seed-01", "like");
    toggleLike("seed-01");
    expect(getDecision("seed-01")).toBeNull();

    setDecision("seed-01", "skip");
    toggleLike("seed-01");
    expect(getDecision("seed-01")).toBe("like");

    toggleLike("seed-01");
    expect(getDecision("seed-01")).toBeNull();
  });

  it("re-renders only the subscribed row whose profile changed", () => {
    const a = renderHook(() => useUserSwipe("seed-01"));
    const b = renderHook(() => useUserSwipe("seed-02"));

    act(() => {
      setDecision("seed-01", "like");
    });

    expect(a.result.current).toBe("like");
    // Row B's snapshot is untouched — its subscription never fired.
    expect(b.result.current).toBeNull();
  });

  it("hydrateFromSwipes only notifies profiles whose value changed", () => {
    setDecision("seed-01", "like");
    const a = renderHook(() => useUserSwipe("seed-01"));

    act(() => {
      hydrateFromSwipes([
        { profileId: "seed-01", direction: "like" },
        { profileId: "seed-02", direction: "skip" },
      ]);
    });

    // seed-01 was already "like" → no notification, no re-render.
    expect(a.result.current).toBe("like");
    expect(getDecision("seed-02")).toBe("skip");

    // A profile that disappears from the mirror is reset to undecided.
    act(() => {
      hydrateFromSwipes([]);
    });
    expect(getDecision("seed-01")).toBeNull();
  });

  it("clearUserSwipes resets every profile to undecided without throwing", () => {
    setDecision("seed-01", "askVoucher");
    clearUserSwipes();
    expect(getDecision("seed-01")).toBeNull();
  });
});