import { describe, expect, it } from "@jest/globals";

import { createEventDedupe } from "@/src/realtime/dedupe";

function event(id: string, occurredAt: number) {
  return { id, occurredAt, type: "matches:new" as const, profileId: "p1", matchId: "m1" };
}

describe("event dedupe (REQUIREMENTS §4.3)", () => {
  it("accepts the first event and rejects a duplicate by id", () => {
    const dedupe = createEventDedupe();
    expect(dedupe.accept(event("e1", 100))).toBe(true);
    expect(dedupe.accept(event("e1", 100))).toBe(false);
  });

  it("accepts a different event with a newer timestamp", () => {
    const dedupe = createEventDedupe();
    expect(dedupe.accept(event("e1", 100))).toBe(true);
    expect(dedupe.accept(event("e2", 200))).toBe(true);
  });

  it("rejects an out-of-order event with an older timestamp", () => {
    const dedupe = createEventDedupe();
    expect(dedupe.accept(event("e1", 200))).toBe(true);
    expect(dedupe.accept(event("e2", 150))).toBe(false);
  });

  it("accepts events with the same timestamp (same burst)", () => {
    const dedupe = createEventDedupe();
    expect(dedupe.accept(event("e1", 100))).toBe(true);
    expect(dedupe.accept(event("e2", 100))).toBe(true);
  });

  it("handles a sequence of events correctly", () => {
    const dedupe = createEventDedupe();
    const results = [
      dedupe.accept(event("a", 10)),
      dedupe.accept(event("b", 20)),
      dedupe.accept(event("a", 10)), // duplicate
      dedupe.accept(event("c", 15)), // out-of-order (older than b)
      dedupe.accept(event("d", 30)), // newer
    ];
    expect(results).toEqual([true, true, false, false, true]);
  });
});
