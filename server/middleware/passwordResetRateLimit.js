import { rateLimit } from "express-rate-limit";

export const buildPasswordResetLimiter = (limit) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      message: "Too many password reset requests. Please try again later.",
    },
  });

export const forgotPasswordRateLimit = buildPasswordResetLimiter(5);
export const resetPasswordRateLimit = buildPasswordResetLimiter(10);
