import express from "express";
import {
  deleteAccount,
  exportUserData,
  forgotPassword,
  registerUser,
  loginUser,
  resendVerificationEmail,
  resetPassword,
  verifyEmail,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  forgotPasswordRateLimit,
  resetPasswordRateLimit,
} from "../middleware/passwordResetRateLimit.js";

//import nodemailer from "nodemailer";
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/resend-verification", resendVerificationEmail);
router.post("/forgot-password", forgotPasswordRateLimit, forgotPassword);
router.post("/reset-password/:token", resetPasswordRateLimit, resetPassword);
router.get("/verify-email", verifyEmail);
router.get("/export-data", protect, exportUserData);
router.delete("/account", protect, deleteAccount);

export default router;
