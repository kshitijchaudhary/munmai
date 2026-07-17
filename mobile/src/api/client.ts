import axios, { AxiosError } from 'axios';

import { isSessionAuthenticationFailure } from '@/api/session-failure';
import { type NormalizedApiError } from '@/auth/types';
import { apiBaseUrl } from '@/config/api';

type AuthFailureHandler = (error: NormalizedApiError) => Promise<void> | void;
type ApiErrorOptions = Omit<NormalizedApiError, 'name' | 'isAuthenticationFailure'> & {
  isAuthenticationFailure?: boolean;
};

class ApiError extends Error implements NormalizedApiError {
  readonly name = 'ApiError' as const;
  readonly status?: number;
  readonly isNetworkError: boolean;
  readonly isServerError: boolean;
  readonly isAuthenticationFailure: boolean;

  constructor({
    message,
    status,
    isNetworkError,
    isServerError,
    isAuthenticationFailure = false,
  }: ApiErrorOptions) {
    super(message);
    this.status = status;
    this.isNetworkError = isNetworkError;
    this.isServerError = isServerError;
    this.isAuthenticationFailure = isAuthenticationFailure;
  }
}

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

let activeToken: string | null = null;
let authFailureHandler: AuthFailureHandler | null = null;
let authFailureNotification: Promise<void> | null = null;

export function setAuthToken(token: string | null) {
  activeToken = token;
}

export function setAuthFailureHandler(handler: AuthFailureHandler | null) {
  authFailureHandler = handler;

  return () => {
    if (authFailureHandler === handler) {
      authFailureHandler = null;
    }
  };
}

function getBackendMessage(data: unknown): string | null {
  if (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof data.message === 'string' &&
    data.message.trim()
  ) {
    return data.message;
  }

  return null;
}

function normalizeApiError(error: unknown): ApiError {
  if (!axios.isAxiosError(error)) {
    return new ApiError({
      message: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      isNetworkError: false,
      isServerError: false,
    });
  }

  const status = error.response?.status;
  const backendMessage = getBackendMessage(error.response?.data);
  const isNetworkError = !error.response;
  const isServerError = typeof status === 'number' && status >= 500;

  let message = backendMessage ?? 'The request could not be completed. Please try again.';

  if (isNetworkError) {
    message = 'Unable to reach Munmai. Check your connection and try again.';
  } else if (isServerError && !backendMessage) {
    message = 'Munmai is temporarily unavailable. Please try again shortly.';
  }

  return new ApiError({
    message,
    status,
    isNetworkError,
    isServerError,
  });
}

function requestHasBearerToken(error: AxiosError): boolean {
  const authorization = error.config?.headers?.get('Authorization');

  return typeof authorization === 'string' && authorization.startsWith('Bearer ');
}

function notifyAuthFailure(error: NormalizedApiError) {
  if (!authFailureHandler || authFailureNotification) {
    return;
  }

  authFailureNotification = Promise.resolve(authFailureHandler(error))
    .catch(() => undefined)
    .finally(() => {
      authFailureNotification = null;
    });
}

apiClient.interceptors.request.use((config) => {
  if (activeToken) {
    config.headers.set('Authorization', `Bearer ${activeToken}`);
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    let normalizedError = normalizeApiError(error);
    const isAuthenticatedRequest = axios.isAxiosError(error) && requestHasBearerToken(error);
    const isSessionFailure = isSessionAuthenticationFailure(
      normalizedError.status,
      normalizedError.message,
      isAuthenticatedRequest,
    );

    if (isSessionFailure) {
      normalizedError = new ApiError({
        message: normalizedError.message,
        status: normalizedError.status,
        isNetworkError: normalizedError.isNetworkError,
        isServerError: normalizedError.isServerError,
        isAuthenticationFailure: true,
      });
      notifyAuthFailure(normalizedError);
    }

    return Promise.reject(normalizedError);
  },
);

export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
