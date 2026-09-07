import { describe, expect, it } from "@jest/globals";

import { emptyFeed, mergePage } from "@/src/features/browse/model/feed";

type Row = { id: string; name: string };

const row = (id: string, name = `n-${id}`): Row => ({ id, name });

describe("browse feed paging (REQUIREMENTS §3.4 — sqlite pagination)", () => {
  it("starts empty with no more pages", () => {
    const state = emptyFeed<Row>();
    expect(state.items).toEqual([]);
    expect(state.hasMore).toBe(false);
  });

  it("appends a page and carries hasMore forward", () => {
    const first = mergePage(emptyFeed<Row>(), {
      items: [row("1"), row("2")],
      hasMore: true,
    });
    expect(first.items.map((i) => i.id)).toEqual(["1", "2"]);
    expect(first.hasMore).toBe(true);

    const second = mergePage(first, {
      items: [row("3")],
      hasMore: false,
    });
    expect(second.items.map((i) => i.id)).toEqual(["1", "2", "3"]);
    expect(second.hasMore).toBe(false);
  });

  it("de-duplicates rows by id so a stale/overlapping page can't double a row", () => {
    const first = mergePage(emptyFeed<Row>(), {
      items: [row("1"), row("2")],
      hasMore: true,
    });
    const overlapped = mergePage(first, {
      items: [row("2"), row("3")],
      hasMore: false,
    });
    expect(overlapped.items.map((i) => i.id)).toEqual(["1", "2", "3"]);
  });

  it("keeps the earliest item for a duplicated id (stable first-seen wins)", () => {
    const first = mergePage(emptyFeed<Row>(), {
      items: [row("1", "original")],
      hasMore: true,
    });
    const overlapped = mergePage(first, {
      items: [row("1", "duplicate")],
      hasMore: false,
    });
    expect(overlapped.items[0].name).toBe("original");
  });
});