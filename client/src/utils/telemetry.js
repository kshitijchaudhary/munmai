import { getApiBaseUrl } from "../api/baseUrl";

const TELEMETRY_BASE_URL = getApiBaseUrl();

const postTelemetry = async (path, payload) => {
  try {
    await fetch(`${TELEMETRY_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (error) {
    console.error("Telemetry post failed:", error);
  }
};

export const trackEvent = (name, metadata = {}) =>
  postTelemetry("/telemetry/event", {
    name,
    route: window.location.pathname,
    metadata,
  });

export const trackError = (name, message, metadata = {}) =>
  postTelemetry("/telemetry/error", {
    name,
    message,
    route: window.location.pathname,
    metadata,
  });
