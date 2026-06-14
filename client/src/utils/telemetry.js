import { getApiBaseUrl } from "../api/baseUrl";
import { hasValidToken } from "./authToken";

const TELEMETRY_BASE_URL = getApiBaseUrl();

const getStoredTelemetryUser = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const savedUser = window.localStorage.getItem("user");
    const user = savedUser ? JSON.parse(savedUser) : null;

    if (!hasValidToken(user)) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
};

const getSafeRoute = () => {
  const pathname = window.location.pathname;

  if (pathname.startsWith("/reset-password/")) {
    return "/reset-password/:token";
  }

  return pathname;
};

const postTelemetry = async (path, payload) => {
  const user = getStoredTelemetryUser();

  if (!user?.token) {
    return;
  }

  try {
    await fetch(`${TELEMETRY_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({
        ...payload,
        userId: user._id || user.id || payload.userId || null,
      }),
      keepalive: true,
    });
  } catch {
    // Telemetry must never interrupt user flows or create console noise.
  }
};

export const trackEvent = (name, metadata = {}) =>
  postTelemetry("/telemetry/event", {
    name,
    route: getSafeRoute(),
    metadata,
  });

export const trackError = (name, message, metadata = {}) =>
  postTelemetry("/telemetry/error", {
    name,
    message,
    route: getSafeRoute(),
    metadata,
  });
