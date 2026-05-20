import multer from "multer";
import {
  commitImportBatch,
  createImportBatchFromCsv,
  deleteImportBatch,
  listImportBatches,
  listImportRows,
  updateImportRow,
} from "../services/importService.js";
import { extractPdfTextPreview } from "../services/import/pdfTextExtractor.js";
import { confirmPdfImportRows } from "../services/import/pdfConfirmImportService.js";
import { parsePdfTransactionPreviewRows } from "../services/import/pdfTransactionParser.js";
import {
  archiveImportHistoryBatch,
  getImportHistoryBatch,
  getImportHistorySummary,
  listImportHistoryBatches,
  listImportHistoryRows,
} from "../services/importHistoryService.js";

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    if (error.statusCode) {
      res.status(error.statusCode);
    }

    next(error);
  }
};

const getUserId = (req) => req.user?.id || req.user?._id;

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    if (
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname?.toLowerCase().endsWith(".csv")
    ) {
      callback(null, true);
      return;
    }

    const error = new Error("Only CSV files are supported");
    error.statusCode = 400;
    callback(error);
  },
});

const csvUploadMiddleware = csvUpload.single("file");

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.PDF_IMPORT_LIMIT_MB || 5) * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    if (
      file.mimetype === "application/pdf" ||
      file.originalname?.toLowerCase().endsWith(".pdf")
    ) {
      callback(null, true);
      return;
    }

    const error = new Error("Only PDF statement files are supported");
    error.statusCode = 400;
    callback(error);
  },
});

const pdfUploadMiddleware = pdfUpload.single("statement");

export const uploadImportCsv = (req, res, next) => {
  csvUploadMiddleware(req, res, (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        error.message = "CSV file is too large";
      }

      error.statusCode = error.statusCode || 400;
      return next(error);
    }

    return next();
  });
};

export const uploadBankStatementPdf = (req, res, next) => {
  pdfUploadMiddleware(req, res, (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        error.message = `PDF statement file is too large. Maximum size is ${
          process.env.PDF_IMPORT_LIMIT_MB || 5
        }MB.`;
      }

      error.statusCode = error.statusCode || 400;
      return next(error);
    }

    return next();
  });
};

export const createCsvImport = asyncHandler(async (req, res) => {
  const result = await createImportBatchFromCsv(getUserId(req), req.file);
  return res.status(201).json(result);
});

export const previewBankStatementPdf = asyncHandler(async (req, res) => {
  if (!getUserId(req)) {
    return res.status(401).json({ message: "Authenticated user is required" });
  }

  const preview = await extractPdfTextPreview(req.file);
  const { rawExtractedText, ...safePreview } = preview;
  const parsedPreview = preview.isTextReadable
    ? parsePdfTransactionPreviewRows(rawExtractedText)
    : parsePdfTransactionPreviewRows("");

  return res.status(200).json({
    ...safePreview,
    ...parsedPreview,
  });
});

export const confirmBankStatementPdfRows = asyncHandler(async (req, res) => {
  const result = await confirmPdfImportRows(getUserId(req), req.body || {});
  return res.status(200).json(result);
});

export const getImportBatches = asyncHandler(async (req, res) => {
  const batches = await listImportBatches(getUserId(req));
  return res.status(200).json({ batches });
});

export const getImportRows = asyncHandler(async (req, res) => {
  const rows = await listImportRows(getUserId(req), req.params.batchId);
  return res.status(200).json({ rows });
});

export const getImportHistory = asyncHandler(async (req, res) => {
  const result = await listImportHistoryBatches(getUserId(req), req.query || {});
  return res.status(200).json(result);
});

export const getImportHistoryById = asyncHandler(async (req, res) => {
  const batch = await getImportHistoryBatch(getUserId(req), req.params.batchId);
  return res.status(200).json({ batch });
});

export const getImportHistoryRows = asyncHandler(async (req, res) => {
  const rows = await listImportHistoryRows(getUserId(req), req.params.batchId);
  return res.status(200).json({ rows });
});

export const getImportHistorySummaryByUser = asyncHandler(async (req, res) => {
  const summary = await getImportHistorySummary(getUserId(req));
  return res.status(200).json(summary);
});

export const archiveImportHistoryBatchById = asyncHandler(async (req, res) => {
  const result = await archiveImportHistoryBatch(getUserId(req), req.params.batchId);
  return res.status(200).json(result);
});

export const updateImportRowById = asyncHandler(async (req, res) => {
  const row = await updateImportRow(getUserId(req), req.params.rowId, req.body || {});
  return res.status(200).json({ row });
});

export const commitImportBatchById = asyncHandler(async (req, res) => {
  const result = await commitImportBatch(getUserId(req), req.params.batchId);
  return res.status(200).json(result);
});

export const deleteImportBatchById = asyncHandler(async (req, res) => {
  const result = await deleteImportBatch(getUserId(req), req.params.batchId);
  return res.status(200).json(result);
});
