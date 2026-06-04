import mongoose from "mongoose";

export const importBatchStatuses = [
  "pending_review",
  "partially_imported",
  "imported",
  "cancelled",
  "reverted",
];

export const importBatchSources = ["csv", "pdf"];

const importBatchSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: importBatchStatuses,
      default: "pending_review",
      index: true,
    },
    importSource: {
      type: String,
      enum: importBatchSources,
      default: "csv",
      index: true,
    },
    importFileHash: {
      type: String,
      trim: true,
      default: "",
    },
    committedAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },
    revertedAt: {
      type: Date,
      default: null,
      index: true,
    },
    revertedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    revertSummary: {
      incomeDeleted: {
        type: Number,
        min: 0,
        default: 0,
      },
      expensesDeleted: {
        type: Number,
        min: 0,
        default: 0,
      },
      skipped: {
        type: Number,
        min: 0,
        default: 0,
      },
      errors: {
        type: Number,
        min: 0,
        default: 0,
      },
    },
    summary: {
      totalProcessed: {
        type: Number,
        min: 0,
        default: 0,
      },
      incomeImported: {
        type: Number,
        min: 0,
        default: 0,
      },
      expensesImported: {
        type: Number,
        min: 0,
        default: 0,
      },
      duplicatesSkipped: {
        type: Number,
        min: 0,
        default: 0,
      },
      unsupportedSkipped: {
        type: Number,
        min: 0,
        default: 0,
      },
      errorsCount: {
        type: Number,
        min: 0,
        default: 0,
      },
    },
    dateRangeStart: {
      type: Date,
      default: null,
    },
    dateRangeEnd: {
      type: Date,
      default: null,
    },
    totalRows: {
      type: Number,
      min: 0,
      default: 0,
    },
    reviewedRows: {
      type: Number,
      min: 0,
      default: 0,
    },
    importedRows: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true }
);

importBatchSchema.index({ user: 1, createdAt: -1 });
importBatchSchema.index({ user: 1, status: 1 });

const ImportBatch = mongoose.model("ImportBatch", importBatchSchema);

export default ImportBatch;
