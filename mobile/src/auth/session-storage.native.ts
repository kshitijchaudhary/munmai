import * as SecureStore from 'expo-secure-store';

import {
  parseSession,
  SESSION_STORAGE_KEY,
  type Session,
} from '@/auth/types';

async function discardMalformedSession() {
  try {
    await clearSession();
  } catch {
    // A malformed value must never prevent the app from starting.
  }
}

export async function readSession(): Promise<Session | null> {
  const storedValue = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  const session = parseSession(storedValue);

  if (!session) {
    await discardMalformedSession();
    return null;
  }

  return session;
}

export async function writeSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
  } catch (deleteError) {
    try {
      await SecureStore.setItemAsync(SESSION_STORAGE_KEY, '');
    } catch {
      throw deleteError;
    }
  }
}
