export const SESSION_STORAGE_KEY = 'munmai.auth.session.v1';
export const SESSION_VERSION = 1 as const;

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
}

export interface Session {
  version: typeof SESSION_VERSION;
  token: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse extends User {
  token: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterResponse {
  message: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export type AuthStatus =
  | 'restoring'
  | 'authenticated'
  | 'unauthenticated'
  | 'restore-error';

export interface NormalizedApiError {
  name: 'ApiError';
  message: string;
  status?: number;
  isNetworkError: boolean;
  isServerError: boolean;
  isAuthenticationFailure: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isUser(value: unknown): value is User {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.email) &&
    typeof value.username === 'string'
  );
}

export function isSession(value: unknown): value is Session {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === SESSION_VERSION &&
    isNonEmptyString(value.token) &&
    isUser(value.user)
  );
}

export function parseSession(storedValue: string): Session | null {
  try {
    const parsedValue: unknown = JSON.parse(storedValue);
    return isSession(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

export function isNormalizedApiError(value: unknown): value is NormalizedApiError {
  return (
    isRecord(value) &&
    value.name === 'ApiError' &&
    typeof value.message === 'string' &&
    (value.status === undefined || typeof value.status === 'number') &&
    typeof value.isNetworkError === 'boolean' &&
    typeof value.isServerError === 'boolean' &&
    typeof value.isAuthenticationFailure === 'boolean'
  );
}
