import User from "../models/User.js";
import Income from "../models/Income.js";
import Expense from "../models/Expense.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import fs from "fs";
import { resolveStoredFilePath } from "../utils/uploadPaths.js";

const createToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const createVerificationToken = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");

  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  return { rawToken, hashedToken };
};

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

const extractEmailAddress = (value = "") => {
  const match = String(value).match(/<([^>]+)>/);
  return (match ? match[1] : value).replace(/"/g, "").trim();
};

const isValidEmailAddress = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const isLocalUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return LOCAL_HOSTNAMES.has(hostname);
  } catch (error) {
    return true;
  }
};

const buildEmailConfigValidation = () => {
  const issues = [];
  const fromAddress = extractEmailAddress(process.env.SMTP_FROM);
  const allowLocalhostEmailLinks =
    process.env.ALLOW_LOCALHOST_EMAIL_LINKS === "true";

  if (
    ![
      process.env.SMTP_HOST,
      process.env.SMTP_PORT,
      process.env.SMTP_USER,
      process.env.SMTP_PASS,
      process.env.SMTP_FROM,
      process.env.SERVER_URL,
      process.env.CLIENT_URL,
    ].every(Boolean)
  ) {
    issues.push("Missing one or more SMTP or app URL environment variables");
  }

  if (!isValidEmailAddress(fromAddress)) {
    issues.push("SMTP_FROM must contain a valid sender email address");
  }

  if (!allowLocalhostEmailLinks && isLocalUrl(process.env.SERVER_URL)) {
    issues.push("SERVER_URL still points to localhost");
  }

  if (!allowLocalhostEmailLinks && isLocalUrl(process.env.CLIENT_URL)) {
    issues.push("CLIENT_URL still points to localhost");
  }

  return {
    valid: issues.length === 0,
    issues,
    summary: issues.join(". "),
  };
};

const isEmailConfigured = () =>
  buildEmailConfigValidation().valid;

const createMailTransporter = () => {
  const validation = buildEmailConfigValidation();

  if (!validation.valid) {
    throw new Error(validation.summary || "Email delivery is not configured");
  }

  return nodemailer.createTransport({
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
};

const buildEmailDeliveryHint = () =>
  "Use a real sender mailbox on a domain you control for SMTP_FROM, and set CLIENT_URL and SERVER_URL to public URLs instead of localhost.";

const prepareVerificationEmail = async (user) => {
  const { rawToken, hashedToken } = createVerificationToken();
  user.verificationToken = hashedToken;
  user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();
  await sendVerificationEmail(user.email, user.name, rawToken);
};

const sendVerificationEmail = async (email, name, rawToken) => {
  const verifyUrl = `${process.env.SERVER_URL}/api/auth/verify-email?token=${rawToken}`;
  const transporter = createMailTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Verify your Finvexa account",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Welcome to Finvexa, ${name}!</h2>
        <p>Please verify your email address to activate your account.</p>
        <p>
          <a
            href="${verifyUrl}"
            style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;"
          >
            Verify Email
          </a>
        </p>
        <p>Or open this link manually:</p>
        <p>${verifyUrl}</p>
        <p>This link expires in 24 hours.</p>
      </div>
    `,
  });
};

const removeStoredFile = (fileUrl) => {
  if (!fileUrl) {
    return;
  }

  const filePath = resolveStoredFilePath(fileUrl);

  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

export const registerUser = async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        message: "Name, email, password, and confirm password are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    if (!isEmailConfigured()) {
      return res.status(500).json({
        message: "Email delivery is not configured correctly.",
        hint: buildEmailDeliveryHint(),
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).json({ message: "User already exists" });
      }

      try {
        await prepareVerificationEmail(existingUser);
        return res.status(200).json({
          message:
            "This account already exists but is not verified. We sent a fresh verification email.",
        });
      } catch (error) {
        return res.status(502).json({
          message:
            "This account exists, but the verification email could not be delivered.",
          hint: buildEmailDeliveryHint(),
          details: error.message,
        });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { rawToken, hashedToken } = createVerificationToken();

    const user = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      isVerified: false,
      verificationToken: hashedToken,
      verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await user.save();

    try {
      await sendVerificationEmail(user.email, user.name, rawToken);

      res.status(201).json({
        message:
          "Registration successful. Please check your email to verify your account.",
      });
    } catch (error) {
      res.status(502).json({
        message:
          "Account created, but the verification email could not be delivered.",
        hint: buildEmailDeliveryHint(),
        details: error.message,
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.redirect(
        `${process.env.CLIENT_URL}/login?verified=failed`
      );
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.redirect(
        `${process.env.CLIENT_URL}/login?verified=failed`
      );
    }

    user.isVerified = true;
    user.verificationToken = "";
    user.verificationTokenExpires = null;

    await user.save();

    return res.redirect(
      `${process.env.CLIENT_URL}/login?verified=success`
    );
  } catch (error) {
    return res.redirect(
      `${process.env.CLIENT_URL}/login?verified=failed`
    );
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in",
      });
    }

    const token = createToken(user._id);

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const resendVerificationEmail = async (req, res) => {
  try {
    const email = String(req.body?.email || "").toLowerCase().trim();

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({
        message: "If an unverified account exists, a new verification link has been sent.",
      });
    }

    if (user.isVerified) {
      return res.status(200).json({
        message: "This email is already verified. You can log in now.",
      });
    }

    const { rawToken, hashedToken } = createVerificationToken();
    user.verificationToken = hashedToken;
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    await sendVerificationEmail(user.email, user.name, rawToken);

    return res.status(200).json({
      message: "A fresh verification email has been sent.",
    });
  } catch (error) {
    res.status(502).json({
      message: "Verification email could not be delivered.",
      hint: buildEmailDeliveryHint(),
      details: error.message,
    });
  }
};

export const exportUserData = async (req, res) => {
  try {
    const [incomes, expenses] = await Promise.all([
      Income.find({ userId: req.user.id }).sort({ date: -1 }).lean(),
      Expense.find({ userId: req.user.id }).sort({ date: -1 }).lean(),
    ]);

    const dataExport = {
      exportedAt: new Date().toISOString(),
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        createdAt: req.user.createdAt,
      },
      summary: {
        incomeCount: incomes.length,
        expenseCount: expenses.length,
        totalIncome: incomes.reduce(
          (sum, income) => sum + Number(income.amount || 0),
          0
        ),
        totalExpense: expenses.reduce(
          (sum, expense) => sum + Number(expense.amount || 0),
          0
        ),
      },
      incomes,
      expenses,
    };

    const exportDate = new Date().toISOString().split("T")[0];

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="finvexa-export-${exportDate}.json"`
    );

    res.status(200).send(JSON.stringify(dataExport, null, 2));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.user.id }).lean();

    expenses.forEach((expense) => removeStoredFile(expense.receiptUrl));

    await Promise.all([
      Income.deleteMany({ userId: req.user.id }),
      Expense.deleteMany({ userId: req.user.id }),
      User.findByIdAndDelete(req.user.id),
    ]);

    res.status(200).json({
      message: "Account and transaction data deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
