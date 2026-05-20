import mongoose from "mongoose";
import ImportBatch from "../models/ImportBatch.js";
import ImportRow from "../models/ImportRow.js";

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 100;
const VALID_IMPORT_SOURCES = new Set(["csv", "pdf"]);

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const assertValidObjectId = (value, message = "Invalid import batch id") => {
  if (!mongoose.Types.ObjectId.isValid(String(value || ""))) {
    throw createError(message, 400);
  }
};

const normalizePositiveInteger = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
};

const buildBatchQuery = (userId, { source } = {}) => {
  const query = { user: userId };

  if (source) {
    if (!VALID_IMPORT_SOURCES.has(source)) {
      throw createError("Import source must be csv or pdf", 400);
    }

    if (source === "csv") {
      query.$or = [
        { importSource: { $in: ["csv", null, ""] } },
        { importSource: { $exists: false } },
      ];
    } else {
      query.importSource = source;
    }
  }

  return query;
};

const getSkippedRowsByBatch = async (batchIds) => {
  if (!batchIds.length) {
    return new Map();
  }

  const skippedCounts = await ImportRow.aggregate([
    {
      $match: {
        importBatch: { $in: batchIds },
        status: { $in: ["ignored", "duplicate_skipped"] },
      },
    },
    {
      $group: {
        _id: "$importBatch",
        count: { $sum: 1 },
      },
    },
  ]);

  return new Map(
    skippedCounts.map((item) => [String(item._id), Number(item.count || 0)])
  );
};

const serializeBatch = (batch, skippedRows = 0) => ({
  _id: batch._id,
  importSource: batch.importSource || "csv",
  fileName: batch.originalFilename,
  status: batch.status,
  summary: batch.summary || {},
  totalRows: Number(batch.totalRows || 0),
  importedRows: Number(batch.importedRows || 0),
  skippedRows: Number(skippedRows || 0),
  createdAt: batch.createdAt,
  committedAt: batch.committedAt || null,
});

export const listImportHistoryBatches = async (userId, queryParams = {}) => {
  const page = normalizePositiveInteger(queryParams.page, 1);
  const limit = normalizePositiveInteger(
    queryParams.limit,
    DEFAULT_HISTORY_LIMIT,
    MAX_HISTORY_LIMIT
  );
  const query = buildBatchQuery(userId, {
    source: String(queryParams.source || "").trim().toLowerCase(),
  });
  const skip = (page - 1) * limit;

  const [batches, total] = await Promise.all([
    ImportBatch.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ImportBatch.countDocuments(query),
  ]);

  const skippedRowsByBatch = await getSkippedRowsByBatch(
    batches.map((batch) => batch._id)
  );

  return {
    batches: batches.map((batch) =>
      serializeBatch(batch, skippedRowsByBatch.get(String(batch._id)) || 0)
    ),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getImportHistoryBatch = async (userId, batchId) => {
  assertValidObjectId(batchId);

  const batch = await ImportBatch.findOne({ _id: batchId, user: userId }).lean();

  if (!batch) {
    throw createError("Import batch not found", 404);
  }

  const skippedRowsByBatch = await getSkippedRowsByBatch([batch._id]);

  return serializeBatch(batch, skippedRowsByBatch.get(String(batch._id)) || 0);
};

export const listImportHistoryRows = async (userId, batchId) => {
  await getImportHistoryBatch(userId, batchId);

  return ImportRow.find({ user: userId, importBatch: batchId })
    .populate("linkedLiability", "_id creditorName currentBalance status")
    .populate(
      "duplicateOfFingerprint",
      "_id importHash recordType recordId recordModel status"
    )
    .sort({ sourceRowNumber: 1, createdAt: 1 })
    .lean();
};

export const getImportHistorySummary = async (userId) => {
  const [batchStats, rowStats] = await Promise.all([
    ImportBatch.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(String(userId)) } },
      {
        $addFields: {
          normalizedImportSource: {
            $cond: [
              { $eq: ["$importSource", "pdf"] },
              "pdf",
              "csv",
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalBatches: { $sum: 1 },
          csvBatches: {
            $sum: {
              $cond: [{ $eq: ["$normalizedImportSource", "csv"] }, 1, 0],
            },
          },
          pdfBatches: {
            $sum: {
              $cond: [{ $eq: ["$normalizedImportSource", "pdf"] }, 1, 0],
            },
          },
        },
      },
    ]),
    ImportRow.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(String(userId)) } },
      {
        $group: {
          _id: null,
          totalImported: {
            $sum: { $cond: [{ $eq: ["$status", "imported"] }, 1, 0] },
          },
          totalDuplicates: {
            $sum: {
              $cond: [{ $eq: ["$status", "duplicate_skipped"] }, 1, 0],
            },
          },
          totalErrors: {
            $sum: { $cond: [{ $eq: ["$status", "error"] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const batches = batchStats[0] || {};
  const rows = rowStats[0] || {};

  return {
    totalBatches: Number(batches.totalBatches || 0),
    csvBatches: Number(batches.csvBatches || 0),
    pdfBatches: Number(batches.pdfBatches || 0),
    totalImported: Number(rows.totalImported || 0),
    totalDuplicates: Number(rows.totalDuplicates || 0),
    totalErrors: Number(rows.totalErrors || 0),
  };
};
