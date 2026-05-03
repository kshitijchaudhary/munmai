import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import crypto from "crypto";

import authRoutes from "./routes/authRoutes.js";
import protect from "./middleware/authMiddleware.js";
import incomeRoutes from "./routes/incomeRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import { errorHandler } from "./middleware/errorMiddleware.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import telemetryRoutes from "./routes/telemetryRoutes.js";
import receiptRoutes from "./routes/receiptRoutes.js";
import groupRoutes from "./routes/groupRoutes.js";
import sharedExpenseRoutes from "./routes/sharedExpenseRoutes.js";
import openingBalanceRoutes from "./routes/openingBalanceRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import groupMembershipRoutes from "./routes/groupMembershipRoutes.js";
import budgetRoutes from "./routes/budgetRoutes.js";
import { ensureUploadDir } from "./utils/uploadPaths.js";

dotenv.config();

const app = express();

const requiredEnvVars = ["MONGO_URI", "JWT_SECRET"];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  console.error(`Missing environment variables: ${missingEnvVars.join(", ")}`);
  process.exit(1);
}

const forceHttps = process.env.FORCE_HTTPS === "true";
const bodyLimit = process.env.REQUEST_BODY_LIMIT || "1mb";
ensureUploadDir();

const normalizeOrigin = (value) => String(value || "").trim().replace(/\/+$/, "");

const allowedOrigins = [
  "http://localhost:5173",
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_ORIGINS || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean),
]
  .map(normalizeOrigin)
  .filter(Boolean);

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});

if (forceHttps) {
  app.use((req, res, next) => {
    const forwardedProto = req.headers["x-forwarded-proto"];

    if (forwardedProto && forwardedProto !== "https") {
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }

    return next();
  });
}

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin like Postman/mobile apps
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
});


app.get("/", (req, res) => {
  res
    .status(200)
    .type("text")
    .send("Munmai API is running 🚀 Use /api/health for service health.");
});

app.use("/api/auth", authRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/income", incomeRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/receipts", receiptRoutes);
app.use("/api/users", userRoutes);
app.use("/api", groupMembershipRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/shared-expenses", sharedExpenseRoutes);
app.use("/api/opening-balances", openingBalanceRoutes);
app.use("/api/budget", budgetRoutes);

app.get("/api/test/protected", protect, (req, res) => {
  res.json({
    message: "Access granted",
    user: req.user,
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB Connection Error:", err);
  });
