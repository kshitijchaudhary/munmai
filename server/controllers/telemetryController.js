import TelemetryEvent from "../models/TelemetryEvent.js";

export const recordTelemetry = async (payload) => {
  try {
    await TelemetryEvent.create(payload);
  } catch (error) {
    console.error("Telemetry write failed:", error.message);
  }
};

export const recordServerError = (payload) =>
  recordTelemetry({
    kind: "server_error",
    level: "error",
    source: "server",
    ...payload,
  });

export const trackEvent = async (req, res) => {
  const { name, route, metadata, userId } = req.body || {};

  await recordTelemetry({
    kind: "event",
    level: "info",
    source: "client",
    name: String(name || "unnamed_event"),
    route: String(route || ""),
    metadata: metadata || {},
    userId: userId || null,
    requestId: req.requestId || "",
  });

  res.status(202).json({ message: "Event accepted" });
};

export const trackClientError = async (req, res) => {
  const { name, message, route, metadata, userId } = req.body || {};

  await recordTelemetry({
    kind: "error",
    level: "error",
    source: "client",
    name: String(name || "client_error"),
    message: String(message || "Unknown client error"),
    route: String(route || ""),
    metadata: metadata || {},
    userId: userId || null,
    requestId: req.requestId || "",
  });

  res.status(202).json({ message: "Client error accepted" });
};
