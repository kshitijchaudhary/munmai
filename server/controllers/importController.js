import multer from "multer";
import {
  commitImportBatch,
  createImportBatchFromCsv,
  deleteImportBatch,
  listImportBatches,
  listImportRows,
  updateImportRow,
} from "../services/importService.js";

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

export const createCsvImport = asyncHandler(async (req, res) => {
  const result = await createImportBatchFromCsv(getUserId(req), req.file);
  return res.status(201).json(result);
});

export const getImportBatches = asyncHandler(async (req, res) => {
  const batches = await listImportBatches(getUserId(req));
  return res.status(200).json({ batches });
});

export const getImportRows = asyncHandler(async (req, res) => {
  const rows = await listImportRows(getUserId(req), req.params.batchId);
  return res.status(200).json({ rows });
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
