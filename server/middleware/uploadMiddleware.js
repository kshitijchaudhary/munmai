import multer from "multer";
import crypto from "crypto";
import { ensureUploadDir } from "../utils/uploadPaths.js";
import {
  isAllowedUploadType,
  normalizeUploadExtension,
} from "../utils/uploadTypes.js";

const uploadLimitMb = Number(process.env.UPLOAD_LIMIT_MB || 5);
const uploadDir = ensureUploadDir();

export const buildStoredUploadFileName = (file) =>
  `${crypto.randomUUID()}${normalizeUploadExtension(file.originalname)}`;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, buildStoredUploadFileName(file));
  },
});

const fileFilter = (req, file, cb) => {
  if (isAllowedUploadType(file.mimetype, file.originalname)) {
    return cb(null, true);
  }

  const error = new Error("Unsupported or mismatched upload media type");
  error.code = "UNSUPPORTED_UPLOAD_MEDIA";
  return cb(error);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: uploadLimitMb * 1024 * 1024 },
});

const uploadErrorResponse = (error) => {
  if (error?.code === "LIMIT_FILE_SIZE") {
    return {
      message: `Upload must be ${uploadLimitMb} MB or smaller`,
      statusCode: 413,
    };
  }

  if (error?.code === "UNSUPPORTED_UPLOAD_MEDIA") {
    return {
      message: "Upload must be a valid JPEG, PNG, or PDF file",
      statusCode: 415,
    };
  }

  return {
    message: "Malformed or missing upload",
    statusCode: 400,
  };
};

export const singleUpload = (
  fieldName,
  { requireFileForMultipart = false } = {},
) => {
  const middleware = upload.single(fieldName);

  return (req, res, next) => {
    middleware(req, res, (error) => {
      if (error) {
        const response = uploadErrorResponse(error);
        return res.status(response.statusCode).json({ message: response.message });
      }

      if (requireFileForMultipart && req.is("multipart/form-data") && !req.file) {
        return res.status(400).json({ message: "Missing upload" });
      }

      return next();
    });
  };
};

export default upload;
