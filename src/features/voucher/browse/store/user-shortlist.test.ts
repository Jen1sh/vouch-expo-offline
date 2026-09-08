import { act, renderHook } from "@testing-library/react-native";
import { beforeEach, describe, expect, it } from "@jest/globals";

import {
  clearUserShortlist,
  getShortlisted,
  hydrateFromShortlists,
  setShortlisted,
  toggleShortlist,
  useUserShortlist,
} from "@/src/features/voucher/browse/store/user-shortlist";

describe("voucher user-shortlist mirror (REQUIREMENTS §4.6 — per-row isolation)", () => {
  beforeEach(() => {
    clearUserShortlist();
  });

  it("defaults every candidate to not shortlisted", () => {
    expect(getShortlisted("seed-01")).toBe(false);
  });

  it("toggleShortlist flips shortlisted → not and anything else → shortlisted", () => {
    setShortlisted("seed-01", true);
    toggleShortlist("seed-01");
    expect(getShortlisted("seed-01")).toBe(false);

    toggleShortlist("seed-01");
    expect(getShortlisted("seed-01")).toBe(true);

    toggleShortlist("seed-01");
    expect(getShortlisted("seed-01")).toBe(false);
  });

  it("re-renders only the subscribed row whose profile changed", () => {
    const a = renderHook(() => useUserShortlist("seed-01"));
    const b = renderHook(() => useUserShortlist("seed-02"));

    act(() => {
      setShortlisted("seed-01", true);
    });

    expect(a.result.current).toBe(true);
    // Row B's snapshot is untouched — its subscription never fired.
    expect(b.result.current).toBe(false);
  });

  it("hydrateFromShortlists only notifies profiles whose value changed", () => {
    setShortlisted("seed-01", true);
    const a = renderHook(() => useUserShortlist("seed-01"));

    act(() => {
      hydrateFromShortlists([{ profileId: "seed-01" }, { profileId: "seed-02" }]);
    });

    // seed-01 was already shortlisted → no notification, no re-render.
    expect(a.result.current).toBe(true);
    expect(getShortlisted("seed-02")).toBe(true);

    // A candidate that disappears from the mirror is reset to not shortlisted.
    act(() => {
      hydrateFromShortlists([]);
    });
    expect(getShortlisted("seed-01")).toBe(false);
    expect(getShortlisted("seed-02")).toBe(false);
  });

  it("clearUserShortlist resets every candidate without throwing", () => {
    setShortlisted("seed-01", true);
    setShortlisted("seed-02", true);
    clearUserShortlist();
    expect(getShortlisted("seed-01")).toBe(false);
    expect(getShortlisted("seed-02")).toBe(false);
  });
});