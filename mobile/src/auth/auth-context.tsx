import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { getCurrentUser, login as loginRequest, register as registerRequest } from '@/api/auth';
import { setAuthFailureHandler, setAuthToken } from '@/api/client';
import { createSessionOperationQueue } from '@/auth/session-operation-queue';
import { clearSession, readSession, writeSession } from '@/auth/session-storage';
import {
  isNormalizedApiError,
  SESSION_VERSION,
  type AuthStatus,
  type LoginRequest,
  type RegisterRequest,
  type RegisterResponse,
  type Session,
  type User,
} from '@/auth/types';

const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please sign in again.';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  authMessage: string | null;
  restoreError: string | null;
  clearAuthMessage: () => void;
  signIn: (request: LoginRequest) => Promise<void>;
  register: (request: RegisterRequest) => Promise<RegisterResponse>;
  signOut: () => Promise<void>;
  retryRestoration: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function restorationErrorMessage(error: unknown) {
  if (isNormalizedApiError(error)) {
    if (error.isNetworkError) {
      return 'Munmai could not validate your saved session. Check your connection and retry.';
    }

    if (error.isServerError) {
      return 'Munmai could not validate your saved session because the server is unavailable.';
    }
  }

  return 'Munmai could not restore your saved session. Retry or sign out.';
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<User | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const operationId = useRef(0);
  const hasStartedRestoration = useRef(false);
  const sessionOperations = useRef(createSessionOperationQueue());

  const clearActiveSession = useCallback(async (message: string | null) => {
    operationId.current += 1;
    setAuthToken(null);
    setUser(null);
    setRestoreError(null);
    setAuthMessage(message);
    setStatus('unauthenticated');

    try {
      await sessionOperations.current.run(clearSession);
    } catch {
      const storageWarning =
        'Munmai could not clear the saved session on this device. Signing in again will replace it.';

      setAuthMessage(message ? `${message} ${storageWarning}` : storageWarning);
    }
  }, []);

  const restoreSession = useCallback(async () => {
    const currentOperation = operationId.current + 1;
    operationId.current = currentOperation;
    setStatus('restoring');
    setRestoreError(null);
    setUser(null);
    setAuthToken(null);

    let storedSession: Session | null;

    try {
      storedSession = await sessionOperations.current.run(readSession);
    } catch (error) {
      if (currentOperation === operationId.current) {
        setStatus('restore-error');
        setRestoreError(restorationErrorMessage(error));
      }
      return;
    }

    if (currentOperation !== operationId.current) {
      return;
    }

    if (!storedSession) {
      setAuthMessage(null);
      setStatus('unauthenticated');
      return;
    }

    setAuthToken(storedSession.token);

    try {
      const refreshedUser = await getCurrentUser();

      if (currentOperation !== operationId.current) {
        return;
      }

      const refreshedSession: Session = {
        version: SESSION_VERSION,
        token: storedSession.token,
        user: refreshedUser,
      };

      await sessionOperations.current.run(() => writeSession(refreshedSession));

      if (currentOperation !== operationId.current) {
        return;
      }

      setUser(refreshedUser);
      setAuthMessage(null);
      setRestoreError(null);
      setStatus('authenticated');
    } catch (error) {
      if (currentOperation !== operationId.current) {
        return;
      }

      if (isNormalizedApiError(error) && error.isAuthenticationFailure) {
        await clearActiveSession(SESSION_EXPIRED_MESSAGE);
        return;
      }

      setStatus('restore-error');
      setRestoreError(restorationErrorMessage(error));
    }
  }, [clearActiveSession]);

  useEffect(() => {
    return setAuthFailureHandler(() => clearActiveSession(SESSION_EXPIRED_MESSAGE));
  }, [clearActiveSession]);

  useEffect(() => {
    if (hasStartedRestoration.current) {
      return;
    }

    hasStartedRestoration.current = true;
    void restoreSession();
  }, [restoreSession]);

  const signIn = useCallback(async (request: LoginRequest) => {
    setAuthMessage(null);
    const response = await loginRequest(request);
    const session: Session = {
      version: SESSION_VERSION,
      token: response.token,
      user: {
        id: response.id,
        name: response.name,
        email: response.email,
        username: response.username,
      },
    };

    await sessionOperations.current.run(() => writeSession(session));
    operationId.current += 1;
    setAuthToken(session.token);
    setUser(session.user);
    setRestoreError(null);
    setStatus('authenticated');
  }, []);

  const register = useCallback((request: RegisterRequest) => registerRequest(request), []);

  const signOut = useCallback(() => clearActiveSession(null), [clearActiveSession]);

  const clearAuthMessage = useCallback(() => setAuthMessage(null), []);

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        authMessage,
        restoreError,
        clearAuthMessage,
        signIn,
        register,
        signOut,
        retryRestoration: restoreSession,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
