import path from "path";

const extensionsByMimeType = new Map([
  ["image/jpeg", new Set([".jpg", ".jpeg"])],
  ["image/png", new Set([".png"])],
  ["application/pdf", new Set([".pdf"])],
]);

const mimeTypeByExtension = new Map(
  [...extensionsByMimeType.entries()].flatMap(([mimeType, extensions]) =>
    [...extensions].map((extension) => [extension, mimeType]),
  ),
);

export const normalizeUploadExtension = (fileName = "") =>
  path.extname(String(fileName)).toLowerCase();

export const isAllowedUploadType = (mimeType, fileName) => {
  const normalizedMimeType = String(mimeType || "").toLowerCase();
  const extension = normalizeUploadExtension(fileName);

  return extensionsByMimeType.get(normalizedMimeType)?.has(extension) === true;
};

export const getStoredUploadMimeType = (fileUrl) =>
  mimeTypeByExtension.get(normalizeUploadExtension(fileUrl)) || "";

export const getSafeStoredUploadExtension = (fileUrl) => {
  const extension = normalizeUploadExtension(fileUrl);
  return mimeTypeByExtension.has(extension) ? extension : "";
};
