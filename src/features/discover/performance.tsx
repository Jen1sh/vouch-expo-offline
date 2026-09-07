import { View } from "react-native";
import { PerformanceMonitor } from "react-native-reanimated";

/**
 * Dev-only evidence channel for REQUIREMENTS.md §4.6 ("the deck must never set
 * React state per frame"). All motion runs on the UI thread through Reanimated
 * shared values; this file counts discrete React renders and snapshots the
 * Reanimated JS/UI FPS meter so the reviewer can read the numbers from a real
 * device/simulator. Results land in docs/TECHNICAL.md.
 */

type DeckPerfState = {
  renders: number;
  rendersAtLastSwipe: number;
};

const state: DeckPerfState = { renders: 0, rendersAtLastSwipe: 0 };

/** Call once per React render of DiscoverScreen (mount effect — runs every render). */
export function recordDiscoverRender(): void {
  state.renders += 1;
}

export function discoverRenderCount(): number {
  return state.renders;
}

/**
 * Snapshot the React re-render cost attributable to one swipe. Because the
 * pan/spring motion never touches React state, the delta between two swipes
 * stays ~1 (the final `advance` commit), not ~frames-per-gesture.
 */
export function logSwipeCost(): void {
  if (!__DEV__) return;
  const rendersBetweenSwipes = Math.max(0, state.renders - state.rendersAtLastSwipe);
  state.rendersAtLastSwipe = state.renders;
  console.info(`[discover.perf] re-renders between swipes: ${rendersBetweenSwipes}`);
}

/** Reanimated JS/UI FPS overlay — absolute, layer 1000, render once per screen. */
export function DeckFpsOverlay() {
  if (!__DEV__) {
    return null;
  }
  return (
    <View pointerEvents="none" style={fpsOverlayStyle}>
      <PerformanceMonitor smoothingFrames={20} />
    </View>
  );
}

const fpsOverlayStyle = {
  position: "absolute" as const,
  top: 4,
  right: 4,
  zIndex: 1000,
};