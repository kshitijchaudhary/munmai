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

//import nodemailer from "nodemailer";
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/resend-verification", resendVerificationEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/verify-email", verifyEmail);
router.get("/export-data", protect, exportUserData);
router.delete("/account", protect, deleteAccount);

/*router.get("/test-email", async (req, res) => {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
  
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: "register@asiandns.com",
        subject: "Finvexa SMTP Test",
        text: "SMTP is working successfully.",
      });
  
      res.status(200).json({ message: "Test email sent successfully" });
    } catch (error) {
      console.error("SMTP test error:", error);
      res.status(500).json({ message: error.message });
    }
  });*/
export default router;
