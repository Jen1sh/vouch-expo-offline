import { describe, expect, it } from "@jest/globals";

import {
  advance,
  classifySwipe,
  createDeck,
  exitVector,
  HORIZONTAL_FLING_VELOCITY,
  HORIZONTAL_SWIPE_THRESHOLD,
  isEmpty,
  undoDeck,
} from "@/src/features/discover/model/deck";

const IDS = ["a", "b", "c"];

describe("deck state machine", () => {
  it("creates an isolated deck in order", () => {
    const deck = createDeck(IDS);
    expect(deck.remaining).toEqual(IDS);
    expect(deck.lastSwipe).toBeNull();
    expect(isEmpty(deck)).toBe(false);
  });

  it("advances by popping the front card and recording lastSwipe", () => {
    const after = advance(createDeck(IDS), "like");
    expect(after.remaining).toEqual(["b", "c"]);
    expect(after.lastSwipe).toEqual({ profileId: "a", direction: "like" });
  });

  it("never mutates the input state", () => {
    const source = createDeck(IDS);
    advance(source, "skip");
    expect(source.remaining).toEqual(IDS);
    expect(source.lastSwipe).toBeNull();
  });

  it("restores exactly the last card on undo — the intermediary swipe is not recoverable", () => {
    const one = advance(createDeck(IDS), "like");
    const two = advance(one, "askVoucher");
    const undone = undoDeck(two);
    expect(undone.remaining).toEqual(["b", "c"]);
    expect(undone.lastSwipe).toBeNull();
  });

  it("undo brings the last card back to the very front and clears undo", () => {
    const after = advance(createDeck(IDS), "like");
    const undone = undoDeck(after);
    expect(undone.remaining).toEqual(["a", "b", "c"]);
    expect(undone.lastSwipe).toBeNull();
  });

  it("undo with nothing to undo is a no-op", () => {
    expect(undoDeck(createDeck(IDS))).toEqual(createDeck(IDS));
  });

  it("undo then re-swipe returns the same person — no one is skipped (1→2→undo→1→2)", () => {
    const deck = createDeck(["a", "b", "c", "d"]);

    const reSwiped = advance(undoDeck(advance(deck, "like")), "like");
    expect(reSwiped.remaining).toEqual(["b", "c", "d"]);
    expect(reSwiped.lastSwipe).toEqual({ profileId: "a", direction: "like" });
  });

  it("undoing a later swipe and re-swiping keeps the same next person (no leap)", () => {
    const deck = createDeck(["a", "b", "c", "d"]);
    const two = advance(advance(deck, "like"), "skip");
    const undone = undoDeck(two);
    expect(undone.remaining).toEqual(["b", "c", "d"]);

    const reSwiped = advance(undone, "like");
    expect(reSwiped.remaining).toEqual(["c", "d"]);
    expect(reSwiped.lastSwipe).toEqual({ profileId: "b", direction: "like" });
  });

  it("reports empty once all cards are gone", () => {
    const all = IDS.reduce((state, _id, index) => {
      const directions = ["like", "skip", "askVoucher"] as const;
      return advance(state, directions[index % directions.length]);
    }, createDeck(IDS));
    expect(isEmpty(all)).toBe(true);
  });
});

describe("classifySwipe thresholds", () => {
  const threshold = HORIZONTAL_SWIPE_THRESHOLD;

  it("classifies a rightward drag as like", () => {
    expect(classifySwipe({ dx: threshold, dy: 0, velocityX: 0, velocityY: 0 })).toBe("like");
  });

  it("classifies a leftward drag as skip", () => {
    expect(classifySwipe({ dx: -threshold, dy: 0, velocityX: 0, velocityY: 0 })).toBe("skip");
  });

  it("classifies an upward drag as askVoucher", () => {
    expect(classifySwipe({ dx: 0, dy: -140, velocityX: 0, velocityY: 0 })).toBe("askVoucher");
  });

  it("returns null for a small drag (springs back)", () => {
    expect(classifySwipe({ dx: threshold * 0.5, dy: 0, velocityX: 0, velocityY: 0 })).toBeNull();
  });

  it("picks the dominant axis: a decisive horizontal beats a shallow vertical", () => {
    expect(classifySwipe({ dx: -threshold, dy: -100, velocityX: 0, velocityY: 0 })).toBe("skip");
  });

  it("picks askVoucher when the vertical dominates, even with horizontal bleed", () => {
    expect(classifySwipe({ dx: -threshold * 0.5, dy: -220, velocityX: 0, velocityY: 0 })).toBe("askVoucher");
  });

  it("a fast horizontal fling lowers the distance bar", () => {
    const dx = threshold * 0.6;
    expect(
      classifySwipe({ dx, dy: 0, velocityX: HORIZONTAL_FLING_VELOCITY, velocityY: 0 })
    ).toBe("like");
  });

  it("an upward fling with slight bleed still asks the voucher", () => {
    expect(
      classifySwipe({ dx: 20, dy: -110, velocityX: 0, velocityY: 1_200 })
    ).toBe("askVoucher");
  });

  it("RTL flips horizontal semantics: like becomes a leftward drag", () => {
    expect(classifySwipe({ dx: -threshold, dy: 0, velocityX: 0, velocityY: 0 }, true)).toBe("like");
    expect(classifySwipe({ dx: threshold, dy: 0, velocityX: 0, velocityY: 0 }, true)).toBe("skip");
  });
});

describe("exitVector geometry", () => {
  it("flies horizontally off the deck for like/skip", () => {
    expect(exitVector("like", 360, 640).x).toBeGreaterThan(360);
    expect(exitVector("skip", 360, 640).x).toBeLessThan(-360);
    expect(exitVector("like", 360, 640).y).toBe(0);
  });

  it("flies straight up for askVoucher", () => {
    const v = exitVector("askVoucher", 360, 640);
    expect(v.y).toBeLessThan(-640);
    expect(v.x).toBe(0);
  });

  it("RTL mirrors the horizontal exits", () => {
    expect(exitVector("like", 360, 640, true).x).toBeLessThan(0);
    expect(exitVector("skip", 360, 640, true).x).toBeGreaterThan(0);
  });
});