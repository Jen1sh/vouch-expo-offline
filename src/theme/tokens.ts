/**
 * Raw design scales for the "Warm Editorial Trust" system defined in
 * `.opencode/skills/DESIGN.md`. The prose "Brand & Style" section is
 * authoritative over the YAML frontmatter (which carries Material-derived
 * defaults). Semantic theme objects in `themes/*` map these scales into
 * `light` / `dark` token sets with identical keys.
 */

export const fontFamilies = {
  serif: {
    400: 'Newsreader-Regular',
    500: 'Newsreader-Medium',
    600: 'Newsreader-SemiBold',
    700: 'Newsreader-Bold',
  },
  sans: {
    400: 'PlusJakartaSans-Regular',
    500: 'PlusJakartaSans-Medium',
    600: 'PlusJakartaSans-SemiBold',
    700: 'PlusJakartaSans-Bold',
  },
} as const;

const serif = fontFamilies.serif;
const sans = fontFamilies.sans;

export const typography = {
  displayHero: {
    fontFamily: serif[400],
    fontSize: 48,
    fontWeight: '400',
    lineHeight: 56,
    letterSpacing: -0.02,
  },
  displayHeroMobile: {
    fontFamily: serif[400],
    fontSize: 36,
    fontWeight: '400',
    lineHeight: 44,
    letterSpacing: -0.02,
  },
  headlineLg: {
    fontFamily: serif[400],
    fontSize: 36,
    fontWeight: '400',
    lineHeight: 44,
    letterSpacing: -0.015,
  },
  headlineLgMobile: {
    fontFamily: serif[400],
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 36,
    letterSpacing: -0.015,
  },
  headlineMd: {
    fontFamily: serif[500],
    fontSize: 24,
    fontWeight: '500',
    lineHeight: 32,
    letterSpacing: -0.01,
  },
  headlineSm: {
    fontFamily: serif[500],
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 28,
    letterSpacing: -0.005,
  },
  titleLg: {
    fontFamily: sans[600],
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    letterSpacing: -0.01,
  },
  titleMd: {
    fontFamily: sans[600],
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: -0.005,
  },
  bodyLg: {
    fontFamily: sans[400],
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 26,
  },
  bodyMd: {
    fontFamily: sans[400],
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
  },
  bodySm: {
    fontFamily: sans[400],
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  labelLg: {
    fontFamily: sans[600],
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.01,
  },
  labelMd: {
    fontFamily: sans[600],
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.02,
  },
  labelCaps: {
    fontFamily: sans[700],
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    letterSpacing: 0.08,
  },
} as const;

export type TypographyToken = keyof typeof typography;

/** 8-point harmonic grid, with 4px increments for atomic elements. */
export const spacing = {
  '2xs': 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
  gutterMobile: 16,
  gutterTablet: 24,
  gutterDesktop: 32,
  cardInset: 20,
  maxContentWidth: 1152,
} as const;

export type SpacingToken = keyof typeof spacing;

export const radius = {
  sm: 4,
  default: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radius;

/**
 * Elevation shadow presets per DESIGN.md. `ambient` uses a warm amber-tinted
 * diffusion for tactile cards (Level 2); the rest are cool slate shadows.
 */
export const shadows = {
  level0: {},
  level1: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  level2: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
  },
  level3: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 6,
  },
  level4: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 25,
    elevation: 5,
  },
} as const;

export type ShadowToken = keyof typeof shadows;

/** Motion timing presets (ms) for the swipe deck and shared transitions. */
export const durations = {
  fast: 180,
  base: 320,
  slow: 500,
} as const;

export type DurationToken = keyof typeof durations;

/**
 * Reanimated spring configs for physical-feeling moments (the swipe deck's
 * return-to-center and fly-out). Values are passed straight to `withSpring`.
 */
export const spring = {
  /** Cancelled drag: quick, settled rebound toward the center line. */
  snapBack: {
    damping: 22,
    stiffness: 240,
    mass: 0.7,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },
  /** Decided swipe: decisive fly-out with overshoot clamped to one direction. */
  dismiss: {
    damping: 18,
    stiffness: 340,
    mass: 0.8,
    overshootClamping: true,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },
} as const;

export type SpringToken = keyof typeof spring;
