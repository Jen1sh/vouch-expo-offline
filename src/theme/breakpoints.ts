/**
 * Breakpoints derived from `.opencode/skills/DESIGN.md`:
 * - mobile: <640px single-column
 * - tablet: 640px–1024px centered deck / dual-pane
 * - desktop: >1024px max-width three-column workflow
 */
export const breakpoints = {
  mobile: 0,
  tablet: 640,
  desktop: 1024,
} as const;

export type Breakpoints = typeof breakpoints;
