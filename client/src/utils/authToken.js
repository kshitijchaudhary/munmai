const decodeJwtPayload = (token) => {
  const [, payload] = String(token || "").split(".");

  if (!payload) {
    return null;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "="
    );

    return JSON.parse(window.atob(paddedPayload));
  } catch {
    return null;
  }
};

export const isJwtExpired = (token) => {
  if (!token) {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  const payload = decodeJwtPayload(token);

  if (!payload || typeof payload.exp !== "number") {
    return true;
  }

  return payload.exp * 1000 <= Date.now();
};

export const hasValidToken = (user) => Boolean(user?.token) && !isJwtExpired(user.token);
