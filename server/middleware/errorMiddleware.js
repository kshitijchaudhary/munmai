import { recordServerError } from "../controllers/telemetryController.js";

export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  recordServerError({
    name: err.name || "UnhandledServerError",
    message: err.message,
    route: req.originalUrl,
    requestId: req.requestId || "",
    metadata: {
      method: req.method,
      statusCode,
      stack: err.stack,
    },
    userId: req.user?.id || null,
  });

  res.status(statusCode).json({
    message: statusCode >= 500 ? "Server Error" : err.message,
    requestId: req.requestId || "",
  });
};
