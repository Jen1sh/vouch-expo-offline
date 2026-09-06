/**
 * Web fallback: expo-secure-store ships an empty web module, so native-only
 * storage would crash web dev / `expo export`. localStorage mirrors the same
 * three functions with an identical async API.
 */
import { STORAGE_KEYS } from '@/src/constants/storage-keys';

export async function getSessionToken(): Promise<string | null> {
  return globalThis.localStorage?.getItem(STORAGE_KEYS.sessionToken) ?? null;
}

export async function setSessionToken(token: string): Promise<void> {
  globalThis.localStorage?.setItem(STORAGE_KEYS.sessionToken, token);
}

export async function deleteSessionToken(): Promise<void> {
  globalThis.localStorage?.removeItem(STORAGE_KEYS.sessionToken);
}