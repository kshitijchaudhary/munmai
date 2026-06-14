import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import path from "path";
import Receipt from "../models/Receipt.js";
import { getUploadDir } from "../utils/uploadPaths.js";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
]);
const allowedExtensions = new Set([".jpeg", ".jpg", ".png", ".pdf"]);
const DEFAULT_WEEKLY_UPLOAD_LIMIT = 8;
const DEFAULT_MAX_SIZE_MB = 10;
const DAYS_IN_WEEK = 7;
const configuredUploadLimitMb = Number(
  process.env.RECEIPT_UPLOAD_MAX_SIZE_MB || ""
);
const uploadLimitMb =
  Number.isFinite(configuredUploadLimitMb) && configuredUploadLimitMb > 0
    ? configuredUploadLimitMb
    : DEFAULT_MAX_SIZE_MB;
const configuredWeeklyUploadLimit = Number.parseInt(
  process.env.RECEIPT_UPLOAD_WEEKLY_LIMIT || DEFAULT_WEEKLY_UPLOAD_LIMIT,
  10
);
const weeklyUploadLimit = Number.isInteger(configuredWeeklyUploadLimit)
  ? configuredWeeklyUploadLimit
  : DEFAULT_WEEKLY_UPLOAD_LIMIT;
const receiptInboxDir = path.join(getUploadDir(), "receipt-inbox");

fs.mkdirSync(receiptInboxDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, receiptInboxDir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const randomName = crypto.randomBytes(16).toString("hex");
    cb(null, `receipt-${randomName}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname || "").toLowerCase();

  if (allowedMimeTypes.has(file.mimetype) && allowedExtensions.has(extension)) {
    cb(null, true);
    return;
  }

  const error = new Error("Unsupported receipt file type");
  error.statusCode = 400;
  cb(error);
};

const receiptInboxUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: uploadLimitMb * 1024 * 1024 },
});

const receiptUploadMiddleware = receiptInboxUpload.single("receipt");

const getUserId = (req) => req.user?.id || req.user?._id;

export const enforceReceiptUploadLimit = async (req, res, next) => {
  try {
    if (weeklyUploadLimit <= 0) {
      return next();
    }

    const userId = getUserId(req);
    const since = new Date(Date.now() - DAYS_IN_WEEK * 24 * 60 * 60 * 1000);
    const recentUploadCount = await Receipt.countDocuments({
      user: userId,
      uploadedAt: { $gte: since },
    });

    if (recentUploadCount >= weeklyUploadLimit) {
      return res.status(429).json({
        message: `Free receipt upload limit reached. You can upload up to ${weeklyUploadLimit} receipts per week.`,
        code: "RECEIPT_UPLOAD_LIMIT_REACHED",
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

export const uploadReceiptInboxFile = (req, res, next) => {
  receiptUploadMiddleware(req, res, (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        error.message = `Receipt file is too large. Maximum allowed size is ${uploadLimitMb} MB.`;
        error.code = "RECEIPT_FILE_TOO_LARGE";
      }

      error.statusCode = error.statusCode || 400;
      return res.status(error.statusCode).json({
        message: error.message,
        ...(error.code ? { code: error.code } : {}),
        requestId: req.requestId || "",
      });
    }

    return next();
  });
};

export default receiptInboxUpload;
