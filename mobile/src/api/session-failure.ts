const EXPLICIT_AUTH_FAILURE_PATTERN =
  /\b(not authorized|token failed|invalid token|jwt expired|jwt invalid|authentication failed)\b/i;

export function isSessionAuthenticationFailure(
  status: number | undefined,
  message: string,
  isAuthenticatedRequest: boolean,
) {
  if (!isAuthenticatedRequest) {
    return false;
  }

  return status === 401 || (status === 403 && EXPLICIT_AUTH_FAILURE_PATTERN.test(message));
}
