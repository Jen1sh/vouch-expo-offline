import { useSyncExternalStore } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

import {
  getControlsSnapshot,
  subscribeControls,
  useDevPanelControls,
} from "@/src/mocks/devPanelControls";

/**
 * Real device connectivity (REQUIREMENTS §4.4 companion). `@react-native-community/netinfo`
 * reports when the device actually loses internet (airplane mode, no mobile
 * data); this module folds that into the same offline channel the simulated
 * network already uses: `useOffline()` / `isOffline()` are true when EITHER the
 * Dev Panel's manual offline toggle is on OR real connectivity is gone. The
 * manual simulator toggle stays as an override so offline can still be
 * exercised while the device is online.
 *
 * NetInfo's `isInternetReachable` is `null` while it is probing — that is
 * treated as "still online" to avoid an offline flash on every state change.
 * "Offline" only starts once the report is a definite `false`.
 */

type ConnectivityListener = () => void;

const listeners = new Set<ConnectivityListener>();
let realOnline = true;

function isReachable(state: NetInfoState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function applyState(state: NetInfoState): void {
  const nextOnline = isReachable(state);
  if (nextOnline !== realOnline) {
    realOnline = nextOnline;
    notify();
  }
}

NetInfo.addEventListener(applyState);

export function getRealOnline(): boolean {
  return realOnline;
}

export function subscribeConnectivity(listener: ConnectivityListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRealOnline(): boolean {
  return useSyncExternalStore(subscribeConnectivity, getRealOnline, getRealOnline);
}

/** Combined offline state — Dev Panel manual toggle OR real connectivity. */
export function isOffline(): boolean {
  return getControlsSnapshot().offline || !realOnline;
}

/** Notifies when either the manual toggle or real connectivity changes. */
export function subscribeOffline(listener: ConnectivityListener): () => void {
  const unsubscribeConnectivity = subscribeConnectivity(listener);
  const unsubscribeControls = subscribeControls(listener);
  return () => {
    unsubscribeConnectivity();
    unsubscribeControls();
  };
}

/** Hook form of `isOffline()`, re-renders on either source of change. */
export function useOffline(): boolean {
  const real = useRealOnline();
  const controls = useDevPanelControls();
  return controls.offline || !real;
}