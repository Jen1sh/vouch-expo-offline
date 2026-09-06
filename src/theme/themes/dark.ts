import { typography, spacing, radius, shadows, fontFamilies } from '../tokens';

/**
 * Dark theme for the "Warm Editorial Trust" system — deep slate/charcoal
 * surfaces with warm stone undertones, same keys as `light.ts` (CONVENTIONS
 * §6.1: parallel files, identical keys so a missing token is obvious).
 */
export const dark = {
  colors: {
    // Brand
    primary: '#E7E7E7',
    onPrimary: '#131B2E',
    primaryContainer: '#131B2E',
    onPrimaryContainer: '#DAE2FD',
    secondary: '#F59E0B',
    onSecondary: '#2F1500',
    secondaryContainer: '#663500',
    onSecondaryContainer: '#FFDCC3',
    tertiary: '#10B981',
    onTertiary: '#002114',
    tertiaryContainer: '#005137',
    onTertiaryContainer: '#85F8C4',
    critical: '#F43F5E',
    onCritical: '#FFFFFF',
    criticalContainer: '#93000A',
    onCriticalContainer: '#FFDAD6',

    // Neutral surfaces
    surface: '#151718',
    surfaceSubdued: '#1C1E21',
    surfaceElevated: '#232527',
    surfaceTint: '#565E74',
    background: '#151718',
    onSurface: '#ECEDEE',
    onSurfaceVariant: '#C6C6CD',
    onSurfaceMuted: '#89898F',

    // Borders
    borderSubtle: '#2A2D31',
    borderStrong: '#3A3E44',

    // Text
    textPrimary: '#ECEDEE',
    textSecondary: '#C6C6CD',
    textMuted: '#89898F',
    textInverse: '#151718',

    // Mode signatures
    memberSurface: '#151718',
    voucherSurface: '#1C1813',
    voucherBorder: '#6E3900',
    voucherAccent: '#F59E0B',

    // Status
    verifiedBackground: '#0F2F22',
    verifiedText: '#6EE7B7',
    verifiedBorder: '#065F46',
    vouchCountBackground: '#33220A',
    vouchCountText: '#FCD34D',
    offlineBackground: '#33261A',
    offlineBorder: '#92400E',
    offlineText: '#FDE68A',
    syncedBackground: '#0F2F22',
    syncedBorder: '#065F46',
    syncedText: '#6EE7B7',

    // Icons / tab
    icon: '#9BA1A6',
    iconDefault: '#89898F',
    iconSelected: '#FFFFFF',
    tint: '#FFFFFF',
    tabIconDefault: '#89898F',
    tabIconSelected: '#FFFFFF',

    // Interactive
    focusRing: 'rgba(245, 158, 11, 0.35)',
    hoverSurface: '#232527',
    destructiveHover: '#93000A',
    devPanelPill: '#0F172A',
    devPanelBorder: '#334155',
    devPanelText: '#94A3B8',

    // Overlays & header
    scrim: 'rgba(0, 0, 0, 0.6)',
    header: '#1C1E21',
    divider: '#2A2D31',
  },
  typography,
  spacing,
  radius,
  shadows,
  fontFamilies,
} as const;
