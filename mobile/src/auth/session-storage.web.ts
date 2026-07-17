import {
  parseSession,
  SESSION_STORAGE_KEY,
  type Session,
} from '@/auth/types';

function getWebStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function discardMalformedSession(storage: Storage) {
  try {
    storage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    try {
      storage.setItem(SESSION_STORAGE_KEY, '');
    } catch {
      // A malformed value must never prevent the app from starting.
    }
  }
}

export async function readSession(): Promise<Session | null> {
  const storage = getWebStorage();

  if (!storage) {
    return null;
  }

  const storedValue = storage.getItem(SESSION_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  const session = parseSession(storedValue);

  if (!session) {
    discardMalformedSession(storage);
    return null;
  }

  return session;
}

export async function writeSession(session: Session): Promise<void> {
  const storage = getWebStorage();

  if (!storage) {
    throw new Error('Web session storage is unavailable.');
  }

  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  const storage = getWebStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(SESSION_STORAGE_KEY);
  } catch (deleteError) {
    try {
      storage.setItem(SESSION_STORAGE_KEY, '');
    } catch {
      throw deleteError;
    }
  }
}
