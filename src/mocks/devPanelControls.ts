import { useSyncExternalStore } from "react";

/**
 * Live Dev-Panel controls for the simulated network layer (REQUIREMENTS §4.4).
 * Backed by a `useSyncExternalStore` module so the Dev Panel and every
 * consumer (`src/mocks/server.ts`, realtime channel, assets) share one value
 * and re-render on knob changes without a state library.
 */

export type DevPanelControls = {
  offline: boolean;
  /** Per-request latency range in ms. */
  latencyMinMs: number;
  latencyMaxMs: number;
  /** 0..1 chance a write request fails with a WriteFailureError. */
  writeFailureRate: number;
  /** 0..1 chance a realtime event is delivered twice. */
  duplicateRate: number;
  /** How many events the realtime channel may hold back / reorder. */
  outOfOrderWindow: number;
  /** When ON, a drained message makes the partner reply via the realtime channel. */
  autoReply: boolean;
};

export const DEFAULT_CONTROLS: DevPanelControls = {
  offline: false,
  latencyMinMs: 300,
  latencyMaxMs: 1200,
  writeFailureRate: 0.2,
  duplicateRate: 0.05,
  outOfOrderWindow: 2,
  autoReply: false,
};

let controls: DevPanelControls = DEFAULT_CONTROLS;
const listeners = new Set<() => void>();

export function subscribeControls(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getControlsSnapshot(): DevPanelControls {
  return controls;
}

export function setDevPanelControls(patch: Partial<DevPanelControls>): void {
  controls = { ...controls, ...patch };
  for (const listener of listeners) {
    listener();
  }
}

export function resetDevPanelControls(): void {
  setDevPanelControls(DEFAULT_CONTROLS);
}

/** Hook form for the Dev Panel UI. */
export function useDevPanelControls(): DevPanelControls {
  return useSyncExternalStore(subscribeControls, getControlsSnapshot, getControlsSnapshot);
}