/**
 * Single source of truth for every key used in device storage (keychain,
 * local storage, etc.). Import these constants instead of spelling the same
 * string in multiple places.
 */
export const STORAGE_KEYS = {
  sessionToken: 'vouch.sessionToken',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];