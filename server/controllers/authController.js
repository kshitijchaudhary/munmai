import User from "../models/User.js";
import Income from "../models/Income.js";
import Expense from "../models/Expense.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import fs from "fs";
import { resolveStoredFilePath } from "../utils/uploadPaths.js";

const usernamePattern = /^[a-z0-9_]+$/;

const createToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const normalizeUsername = (value) => String(value || "").trim().toLowerCase();

const isValidUsername = (value) => usernamePattern.test(value);

const buildAuthUserPayload = (user, token) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  username: user.username || "",
  token,
});

const createVerificationToken = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");

  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  return { rawToken, hashedToken };
};

const createSecureToken = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  return { rawToken, hashedToken };
};

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

const extractEmailAddress = (value = "") => {
  const match = String(value).match(/<([^>]+)>/);
  return (match ? match[1] : value).replace(/"/g, "").trim();
};

const isValidEmailAddress = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const isPrivateIpv4Address = (hostname) => {
  const parts = hostname.split(".").map(Number);

  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
};

const isLocalUrl = (value) => {
  try {
    const hostname = new URL(value).hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, "");
    return (
      LOCAL_HOSTNAMES.has(hostname) ||
      hostname.endsWith(".local") ||
      isPrivateIpv4Address(hostname) ||
      /^f[cd][\da-f:]*$/i.test(hostname) ||
      /^fe[89ab][\da-f:]*$/i.test(hostname)
    );
  } catch (error) {
    return true;
  }
};

const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
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
    issues.push("CLIENT_URL points to a local or private address");
  }

  if (
    !allowLocalhostEmailLinks &&
    !isLocalUrl(process.env.CLIENT_URL) &&
    !isHttpsUrl(process.env.CLIENT_URL)
  ) {
    issues.push("CLIENT_URL must use HTTPS");
  }

  return {
    valid: issues.length === 0,
    issues,
    summary: issues.join(". "),
  };
};

const isEmailConfigured = () => buildEmailConfigValidation().valid;

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
    subject: "Verify your Munmai account",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Welcome to Munmai, ${name} 👋</h2>
        <p>You're one step away from getting full control over your finances.</p>
        <p>Please verify your email address to activate your account.</p>
        <p>
          <a
            href="${verifyUrl}"
            style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;"
          >
            Verify Email
          </a>
        </p>
        <p>If the button doesn't work, you can copy and paste this link:</p>
        <p>${verifyUrl}</p>
        <p>This link expires in 24 hours. If you didn't request this verification, please ignore this email.</p>
        <p>Thanks for choosing Munmai.</p>
      </div>
    `,
  });
};

const sendPasswordResetEmail = async (email, name, rawToken) => {
  const clientUrl = String(process.env.CLIENT_URL || "").replace(/\/+$/, "");
  const resetUrl = `${clientUrl}/reset-password/${rawToken}`;
  const transporter = createMailTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Reset your Munmai password",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Password reset requested</h2>
        <p>Hello ${name},</p>
        <p>Use the button below to reset your Munmai password. This link expires in 1 hour.</p>
        <p>
          <a
            href="${resetUrl}"
            style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;"
          >
            Reset Password
          </a>
        </p>
        <p>If the button doesn't work, copy and paste this link:</p>
        <p>${resetUrl}</p>
        <p>If you did not request this reset, you can ignore this email.</p>
      </div>
    `,
  });
};

const removeStoredFile = async (fileUrl) => {
  if (!fileUrl) {
    return;
  }

  const filePath = resolveStoredFilePath(fileUrl);

  if (!filePath) {
    return;
  }

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("Failed to remove stored account file", {
        fileUrl,
        error: error?.message,
      });
    }
  }
};

export const registerUser = async (req, res) => {
  try {
    const { name, email, username, password, confirmPassword } = req.body;
    const normalizedEmail = String(email || "").toLowerCase().trim();
    const normalizedUsername = normalizeUsername(username);

    if (!name || !normalizedEmail || !normalizedUsername || !password || !confirmPassword) {
      return res.status(400).json({
        message:
          "Name, email, username, password, and confirm password are required",
      });
    }

    if (!isValidUsername(normalizedUsername)) {
      return res.status(400).json({
        message: "Username must use only letters, numbers, and underscores",
      });
    }

    if (normalizedUsername.length < 3) {
      return res.status(400).json({
        message: "Username must be at least 3 characters",
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

    const emailValidation = buildEmailConfigValidation();
    console.log("EMAIL CONFIG VALIDATION:", emailValidation);

    if (!emailValidation.valid) {
      return res.status(500).json({
        message: "Email delivery is not configured correctly.",
        hint: buildEmailDeliveryHint(),
        details: emailValidation.summary,
      });
    }

    const existingUsernameUser = await User.findOne({ username: normalizedUsername });

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      if (
        existingUsernameUser &&
        String(existingUsernameUser._id) !== String(existingUser._id)
      ) {
        return res.status(400).json({ message: "Username is already taken" });
      }

      if (existingUser.isVerified) {
        return res.status(400).json({ message: "User already exists" });
      }

      try {
        existingUser.name = String(name).trim();
        existingUser.username = normalizedUsername;
        await existingUser.save();
        await prepareVerificationEmail(existingUser);
        return res.status(200).json({
          message:
            "This account already exists but is not verified. We sent a new verification email.",
        });
      } catch (error) {
        return res.status(502).json({
          message:
            "Sorry, we couldn't send the verification email. This account exists, but the verification email could not be delivered.",
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
      email: normalizedEmail,
      username: normalizedUsername,
      password: hashedPassword,
      isVerified: false,
      verificationToken: hashedToken,
      verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await user.save();

    try {
      await sendVerificationEmail(user.email, user.name, rawToken);

      return res.status(201).json({
        message:
          "Registration successful. Please check your email to verify your account.",
      });
    } catch (error) {
      return res.status(502).json({
        message:
          "Account created, but the verification email could not be delivered.",
        hint: buildEmailDeliveryHint(),
        details: error.message,
      });
    }
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.username) {
      return res.status(400).json({ message: "Username is already taken" });
    }

    return res.status(500).json({ message: error.message });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.redirect(`${process.env.CLIENT_URL}/login?verified=failed`);
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
      return res.redirect(`${process.env.CLIENT_URL}/login?verified=failed`);
    }

    user.isVerified = true;
    user.verificationToken = "";
    user.verificationTokenExpires = null;

    await user.save();

    return res.redirect(`${process.env.CLIENT_URL}/login?verified=success`);
  } catch (error) {
    return res.redirect(`${process.env.CLIENT_URL}/login?verified=failed`);
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

    return res.json(buildAuthUserPayload(user, token));
  } catch (error) {
    return res.status(500).json({ message: error.message });
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
        message:
          "If an unverified account exists, a new verification link has been sent.",
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
    return res.status(502).json({
      message: "Verification email could not be delivered.",
      hint: buildEmailDeliveryHint(),
      details: error.message,
    });
  }
};

export const forgotPassword = async (req, res) => {
  const genericMessage =
    "If an account exists, a password reset email has been sent.";

  try {
    const email = String(req.body?.email || "").toLowerCase().trim();

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({ message: genericMessage });
    }

    const { rawToken, hashedToken } = createSecureToken();
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    try {
      await sendPasswordResetEmail(user.email, user.name, rawToken);
    } catch {
      console.warn("Password reset email failed", {
        userId: String(user._id),
      });
    }

    return res.status(200).json({ message: genericMessage });
  } catch (error) {
    return res.status(500).json({ message: "Password reset could not be requested" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Reset token is required" });
    }

    if (!password || !confirmPassword) {
      return res.status(400).json({
        message: "Password and confirm password are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = await User.findOneAndUpdate(
      {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: new Date() },
      },
      {
        $set: {
          password: hashedPassword,
          resetPasswordToken: "",
          resetPasswordExpires: null,
        },
      },
      {
        projection: { _id: 1 },
        runValidators: true,
      }
    );

    if (!user) {
      return res.status(400).json({
        message: "Password reset link is invalid or expired",
      });
    }

    return res.status(200).json({
      message: "Password reset successful. You can now log in.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Password reset failed" });
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
        username: req.user.username || "",
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
      `attachment; filename="munmai-export-${exportDate}.json"`
    );

    return res.status(200).send(JSON.stringify(dataExport, null, 2));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const [incomes, expenses] = await Promise.all([
      Income.find({ userId: req.user.id }).lean(),
      Expense.find({ userId: req.user.id }).lean(),
    ]);

    await Income.deleteMany({ userId: req.user.id });
    await Promise.all(incomes.map((income) => removeStoredFile(income.fileUrl)));

    await Expense.deleteMany({ userId: req.user.id });
    await Promise.all(expenses.map((expense) => removeStoredFile(expense.receiptUrl)));

    await User.findByIdAndDelete(req.user.id);

    return res.status(200).json({
      message: "Account and transaction data deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};
