import { useEffect, useRef } from "react";
import { View } from "react-native";

import Text from "@/components/Text";

/**
 * Dev-only evidence channel for voucher Browse's shortlist isolation (same
 * contract as Browse/Discover, REQUIREMENTS §3.4/§4.6): toggling one row's
 * bookmark must not re-render sibling rows — prove it. Each row mounts a
 * `VoucherRowRenderBadge` showing its own render count, and a shortlist toggle
 * logs the counts of every mounted row so the device capture shows exactly one
 * counter moving.
 */

const rowRenders = new Map<string, number>();
const mountedRows = new Set<string>();

export function markVoucherRowMounted(profileId: string): void {
  mountedRows.add(profileId);
}

export function markVoucherRowUnmounted(profileId: string): void {
  mountedRows.delete(profileId);
}

export function voucherRowRenderCount(profileId: string): number {
  return rowRenders.get(profileId) ?? 0;
}

export function recordVoucherRowRender(profileId: string): void {
  rowRenders.set(profileId, voucherRowRenderCount(profileId) + 1);
}

/** Called from the shortlist toggle; prints the live render count of every row. */
export function logVoucherShortlistToggle(profileId: string): void {
  if (!__DEV__) {
    return;
  }
  const counts = [...mountedRows].sort().map((id) => `${id}:${voucherRowRenderCount(id)}`);
  console.info(
    `[voucher.perf] toggled "${profileId}" — mounted row renders: ${counts.join(", ")}`
  );
}

/**
 * Tiny per-row counter (dev builds only) that visualizes the isolation claim:
 * after any shortlist toggle only the affected row's `×N` advances. Absolutely
 * positioned at the row's top-left so it's clearly readable.
 */
export function VoucherRowRenderBadge({ profileId }: { profileId: string }) {
  const render = useRef(0);
  render.current += 1;

  useEffect(() => {
    markVoucherRowMounted(profileId);
    recordVoucherRowRender(profileId);
    return () => markVoucherRowUnmounted(profileId);
  }, [profileId]);

  if (!__DEV__) {
    return null;
  }
  return (
    <View style={voucherBadgeWrap} pointerEvents="none">
      <Text variant="labelCaps" color="critical">{`re-render \u00d7${render.current}`}</Text>
    </View>
  );
}

const voucherBadgeWrap = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  backgroundColor: "rgba(0,0,0,0.55)",
  borderRadius: 6,
  paddingHorizontal: 6,
  paddingVertical: 2,
  zIndex: 10,
};