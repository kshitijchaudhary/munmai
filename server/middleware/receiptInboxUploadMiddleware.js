import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import path from "path";
import { getUploadDir } from "../utils/uploadPaths.js";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
]);
const allowedExtensions = new Set([".jpeg", ".jpg", ".png", ".pdf"]);
const uploadLimitMb = Number(process.env.UPLOAD_LIMIT_MB || 5);
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

export const uploadReceiptInboxFile = (req, res, next) => {
  receiptUploadMiddleware(req, res, (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        error.message = `Receipt file is too large. Maximum size is ${uploadLimitMb}MB.`;
      }

      error.statusCode = error.statusCode || 400;
      return res.status(error.statusCode).json({
        message: error.message,
        requestId: req.requestId || "",
      });
    }

    return next();
  });
};

export default receiptInboxUpload;
