import mongoose from "mongoose";

export const importFingerprintSources = ["csv", "pdf"];

export const importFingerprintRecordTypes = [
  "income",
  "expense",
  "liability_payment",
  "transfer",
  "ignore",
];

export const importFingerprintStatuses = [
  "imported",
  "duplicate_skipped",
  "skipped",
  "error",
  "record_deleted",
];

const importedRecordFingerprintSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    importHash: {
      type: String,
      required: true,
      trim: true,
    },
    importSource: {
      type: String,
      enum: importFingerprintSources,
      required: true,
      index: true,
    },
    importFileName: {
      type: String,
      trim: true,
      default: "",
    },
    importBatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ImportBatch",
      default: null,
    },
    recordType: {
      type: String,
      enum: importFingerprintRecordTypes,
    },
    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    recordModel: {
      type: String,
      trim: true,
      default: "",
    },
    date: {
      type: Date,
      default: null,
    },
    amount: {
      type: Number,
      min: 0,
      default: 0,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      default: "",
    },
    sourceRowNumber: {
      type: Number,
      min: 0,
      default: 0,
    },
    originalRawText: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: importFingerprintStatuses,
      required: true,
      default: "imported",
      index: true,
    },
    errorMessage: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

importedRecordFingerprintSchema.index(
  { user: 1, importHash: 1 },
  { unique: true }
);
importedRecordFingerprintSchema.index({ user: 1, createdAt: -1 });
importedRecordFingerprintSchema.index({ user: 1, importSource: 1 });

const ImportedRecordFingerprint = mongoose.model(
  "ImportedRecordFingerprint",
  importedRecordFingerprintSchema
);

export default ImportedRecordFingerprint;
