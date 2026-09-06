import * as SecureStore from 'expo-secure-store';

import { STORAGE_KEYS } from '@/src/constants/storage-keys';

export async function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.sessionToken);
}

export async function setSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.sessionToken, token);
}

export async function deleteSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.sessionToken);
}