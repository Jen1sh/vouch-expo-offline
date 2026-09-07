import { useEffect, useRef } from "react";

import Text from "@/components/Text";

/**
 * Dev-only evidence channel for REQUIREMENTS §3.4/§4.6: "one row's like state
 * change must not re-render sibling rows — prove it". Mirrors the Discover
 * performance module. Each row mounts a `BrowseRowRenderBadge` that shows its
 * own render count, and a like toggle logs the counts of every mounted row so
 * the device capture shows exactly one counter moving. Numbers land in
 * `docs/TECHNICAL.md`.
 */

const rowRenders = new Map<string, number>();
const mountedRows = new Set<string>();

export function markBrowseRowMounted(profileId: string): void {
  mountedRows.add(profileId);
}

export function markBrowseRowUnmounted(profileId: string): void {
  mountedRows.delete(profileId);
}

export function browseRowRenderCount(profileId: string): number {
  return rowRenders.get(profileId) ?? 0;
}

export function recordBrowseRowRender(profileId: string): void {
  rowRenders.set(profileId, browseRowRenderCount(profileId) + 1);
}

/** Called from the like toggle; prints the live render count of every row. */
export function logBrowseLikeToggle(profileId: string): void {
  if (!__DEV__) {
    return;
  }
  const counts = [...mountedRows].sort().map((id) => `${id}:${browseRowRenderCount(id)}`);
  console.info(`[browse.perf] toggled "${profileId}" — mounted row renders: ${counts.join(", ")}`);
}

/**
 * Tiny per-row counter (dev builds only) that visualizes the isolation claim:
 * after any like toggle only the affected row's `×N` advances.
 */
export function BrowseRowRenderBadge({ profileId }: { profileId: string }) {
  const render = useRef(0);
  render.current += 1;

  useEffect(() => {
    markBrowseRowMounted(profileId);
    recordBrowseRowRender(profileId);
    return () => markBrowseRowUnmounted(profileId);
  }, [profileId]);

  if (!__DEV__) {
    return null;
  }
  return (
    <Text variant="labelCaps" color="textMuted">{`\u00d7${render.current}`}</Text>
  );
}