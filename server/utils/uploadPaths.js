import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");

const resolveUploadDir = () => {
  const configuredDir = process.env.UPLOAD_DIR;

  if (!configuredDir) {
    return path.join(serverRoot, "uploads");
  }

  if (path.isAbsolute(configuredDir)) {
    return configuredDir;
  }

  return path.resolve(serverRoot, configuredDir);
};

export const getUploadDir = () => resolveUploadDir();

export const ensureUploadDir = () => {
  const uploadDir = resolveUploadDir();
  fs.mkdirSync(uploadDir, { recursive: true });
  return uploadDir;
};

export const resolveStoredFilePath = (fileUrl = "") => {
  const fileName = path.basename(String(fileUrl || "").trim());

  if (!fileName) {
    return "";
  }

  return path.join(resolveUploadDir(), fileName);
};
