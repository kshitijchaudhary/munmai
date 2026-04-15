import multer from "multer";
import path from "path";
import { ensureUploadDir } from "../utils/uploadPaths.js";

const allowedMimeTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
];
const allowedExtensions = [".jpeg", ".jpg", ".png", ".pdf"];
const uploadLimitMb = Number(process.env.UPLOAD_LIMIT_MB || 5);
const uploadDir = ensureUploadDir();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Format: fieldname-timestamp.extension
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const extname = path.extname(file.originalname).toLowerCase();
  const validExtension = allowedExtensions.includes(extname);
  const validMimeType = allowedMimeTypes.includes(file.mimetype);

  if (validMimeType && validExtension) {
    return cb(null, true);
  } else {
    cb(new Error("Only images (jpeg, jpg, png) and PDFs are allowed"));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: uploadLimitMb * 1024 * 1024 },
});

export default upload;
