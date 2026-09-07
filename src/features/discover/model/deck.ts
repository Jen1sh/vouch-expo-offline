/**
 * Pure, RN-free state machine for the Discover card deck (REQUIREMENTS §3.3).
 * Holds what is left to view and exactly one level of undo. The gesture
 * classification and exit geometry live here too so the whole "swipe rules"
 * surface is unit-testable without mounting any component.
 */

export type SwipeDirection = "like" | "skip" | "askVoucher";

export type DeckSwipe = {
  profileId: string;
  direction: SwipeDirection;
};

export type DeckState = {
  /** profileIds still to view, front first. */
  remaining: string[];
  /** Last completed swipe only — undo is strictly one level. */
  lastSwipe: DeckSwipe | null;
};

/** Pixel / velocity thresholds for the hand-written gesture. */
export const HORIZONTAL_SWIPE_THRESHOLD = 110;
export const VERTICAL_SWIPE_THRESHOLD = 140;
export const HORIZONTAL_FLING_VELOCITY = 900;
export const VERTICAL_FLING_VELOCITY = 1_000;
export const MAX_ROTATION_DEG = 12;

/** How many physical cards are visible in the stack at once. */
export const DECK_VISIBLE_SLOTS = 3;

/** Depth curve for under-cards: each level back is a fixed scale/Y offset. */
export const UNDERCARD_SCALE_STEP = 0.05;
export const UNDERCARD_TRANSLATE_STEP = 10;

export function createDeck(profileIds: readonly string[]): DeckState {
  return { remaining: [...profileIds], lastSwipe: null };
}

/** Pops the front card; records it as the one-level undo source. */
export function advance(state: DeckState, direction: SwipeDirection): DeckState {
  const [front, ...rest] = state.remaining;
  if (!front) {
    return state;
  }
  return { remaining: rest, lastSwipe: { profileId: front, direction } };
}

/** Restores exactly the last swiped card to the front; clears undo. */
export function undoDeck(state: DeckState): DeckState {
  if (!state.lastSwipe) {
    return state;
  }
  return { remaining: [state.lastSwipe.profileId, ...state.remaining], lastSwipe: null };
}

export function isEmpty(state: DeckState): boolean {
  return state.remaining.length === 0;
}

/** Depth geometry a physical card should render at for a slot index (0 = front). */
export function depthForSlot(index: number): number {
  return index * UNDERCARD_TRANSLATE_STEP;
}

export type GestureSample = {
  dx: number;
  dy: number;
  velocityX: number;
  velocityY: number;
};

/**
 * Maps a pan's final translation + velocity to a swipe intent, or null when
 * the gesture should spring back to center. Dominant axis decides between
 * horizontal (like/skip) and vertical (ask-voucher); a fast fling lowers the
 * distance bar. `rtl` flips the horizontal semantics — in Arabic "forward"
 * (like) is a leftward drag.
 */
export function classifySwipe(sample: GestureSample, rtl = false): SwipeDirection | null {
  'worklet';
  const dir = rtl ? -1 : 1;
  const dxSem = sample.dx * dir;

  const flingX = Math.abs(sample.velocityX) >= HORIZONTAL_FLING_VELOCITY && Math.abs(sample.dx) >= HORIZONTAL_SWIPE_THRESHOLD * 0.5;
  const flingUp = Math.abs(sample.velocityY) >= VERTICAL_FLING_VELOCITY && Math.abs(sample.dy) >= VERTICAL_SWIPE_THRESHOLD * 0.5;

  if (Math.abs(sample.dx) >= Math.abs(sample.dy)) {
    if (dxSem >= HORIZONTAL_SWIPE_THRESHOLD || (flingX && dxSem > 0)) {
      return "like";
    }
    if (dxSem <= -HORIZONTAL_SWIPE_THRESHOLD || (flingX && dxSem < 0)) {
      return "skip";
    }
    return null;
  }

  if (sample.dy <= -VERTICAL_SWIPE_THRESHOLD || (flingUp && sample.dy < 0)) {
    return "askVoucher";
  }
  return null;
}

/** Where a card's center should fly to for a given direction (fully off-screen). */
export function exitVector(
  direction: SwipeDirection,
  width: number,
  height: number,
  rtl = false
): { x: number; y: number } {
  'worklet';
  const dir = rtl ? -1 : 1;
  switch (direction) {
    case "like":
      return { x: dir * (width + 48), y: 0 };
    case "skip":
      return { x: -dir * (width + 48), y: 0 };
    case "askVoucher":
      return { x: 0, y: -(height + 48) };
  }
}