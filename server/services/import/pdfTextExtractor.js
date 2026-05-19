import { PDFParse } from "pdf-parse";

const MIN_READABLE_TEXT_LENGTH = 80;
const SAMPLE_CHARACTER_LIMIT = 2000;

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeWhitespace = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const hasPdfSignature = (buffer) =>
  Buffer.isBuffer(buffer) && buffer.subarray(0, 4).toString("utf8") === "%PDF";

export const extractPdfTextPreview = async (file) => {
  if (!file?.buffer) {
    throw createError("PDF statement file is required", 400);
  }

  const originalName = file.originalname || "statement.pdf";
  const isPdfMimeType = file.mimetype === "application/pdf";
  const isPdfExtension = originalName.toLowerCase().endsWith(".pdf");

  if (!isPdfMimeType && !isPdfExtension) {
    throw createError("Only PDF statement files are supported", 400);
  }

  if (!hasPdfSignature(file.buffer)) {
    throw createError("Uploaded file is not a valid PDF", 400);
  }

  const parser = new PDFParse({ data: file.buffer });

  try {
    const result = await parser.getText();
    const normalizedText = normalizeWhitespace(result?.text);
    const textLength = normalizedText.length;
    const pageCount = Number.isFinite(result?.total) ? result.total : null;
    const isTextReadable = textLength >= MIN_READABLE_TEXT_LENGTH;

    return {
      message: isTextReadable
        ? "PDF text preview extracted successfully."
        : "This PDF does not appear to contain enough readable text. It may be scanned or image-based.",
      fileName: originalName,
      pageCount,
      isTextReadable,
      textLength,
      extractedTextSample: normalizedText.slice(0, SAMPLE_CHARACTER_LIMIT),
    };
  } catch (error) {
    throw createError(
      "Unable to extract text from this PDF. It may be encrypted, scanned, or unsupported.",
      400
    );
  } finally {
    await parser.destroy();
  }
};
