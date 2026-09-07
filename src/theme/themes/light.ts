import { typography, spacing, radius, shadows, fontFamilies, durations, spring } from '../tokens';

/**
 * Light theme for the "Warm Editorial Trust" system — warm stone/cream
 * surfaces, slate-charcoal primary, amber trust accents, emerald verified.
 * Keys mirror `dark.ts` exactly (see CONVENTIONS.md §6.1).
 */
export const light = {
  colors: {
    // Brand
    primary: '#0F172A',
    onPrimary: '#FFFFFF',
    primaryContainer: '#DAE2FD',
    onPrimaryContainer: '#131B2E',
    secondary: '#D97706',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#FDF0E2',
    onSecondaryContainer: '#92400E',
    tertiary: '#059669',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#D1FAE5',
    onTertiaryContainer: '#065F46',
    critical: '#E11D48',
    onCritical: '#FFFFFF',
    criticalContainer: '#FFF1F2',
    onCriticalContainer: '#93000A',

    // Neutral surfaces
    surface: '#FAFAF9',
    surfaceSubdued: '#F5F5F4',
    surfaceElevated: '#FFFFFF',
    surfaceTint: '#565E74',
    background: '#FAFAF9',
    onSurface: '#0F172A',
    onSurfaceVariant: '#57534E',
    onSurfaceMuted: '#A8A29E',

    // Borders
    borderSubtle: '#E7E5E4',
    borderStrong: '#D6D3D1',

    // Text
    textPrimary: '#0F172A',
    textSecondary: '#57534E',
    textMuted: '#A8A29E',
    textInverse: '#FFFFFF',

    // Mode signatures
    memberSurface: '#FAFAF9',
    voucherSurface: '#FBF8F3',
    voucherBorder: '#FDE68A',
    voucherAccent: '#D97706',

    // Status
    verifiedBackground: '#ECFDF5',
    verifiedText: '#065F46',
    verifiedBorder: '#A7F3D0',
    vouchCountBackground: '#FEF3C7',
    vouchCountText: '#92400E',
    offlineBackground: '#FFFBEB',
    offlineBorder: '#FDE68A',
    offlineText: '#92400E',
    syncedBackground: '#ECFDF5',
    syncedBorder: '#A7F3D0',
    syncedText: '#065F46',

    // Icons / tab
    icon: '#57534E',
    iconDefault: '#A8A29E',
    iconSelected: '#0F172A',
    tint: '#0F172A',
    tabIconDefault: '#A8A29E',
    tabIconSelected: '#0F172A',

    // Interactive
    focusRing: 'rgba(217, 119, 6, 0.25)',
    hoverSurface: '#F5F5F4',
    destructiveHover: '#FEE2E2',
    devPanelPill: '#0F172A',
    devPanelBorder: '#334155',
    devPanelText: '#94A3B8',

    // Overlays & header
    scrim: 'rgba(15, 23, 42, 0.4)',
    header: '#0F172A',
    divider: '#E7E5E4',
    imageScrim: 'rgba(15, 23, 42, 0.45)',
    imageScrimDotInactive: 'rgba(255, 255, 255, 0.55)',
  },
  typography,
  spacing,
  radius,
  shadows,
  fontFamilies,
  durations,
  spring,
} as const;

export type AppTheme = typeof light;
