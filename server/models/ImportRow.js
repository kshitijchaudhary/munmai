import mongoose from "mongoose";

export const importDirections = ["inflow", "outflow"];

export const importClassifications = [
  "income",
  "expense",
  "debt_payment",
  "transfer",
  "ignore",
  "unclassified",
];

export const importRowStatuses = [
  "needs_review",
  "ready",
  "imported",
  "ignored",
  "duplicate_skipped",
  "error",
  "reverted",
];

const importRowSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    importBatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ImportBatch",
      required: true,
      index: true,
    },
    rawDate: {
      type: String,
      trim: true,
      default: "",
    },
    rawDescription: {
      type: String,
      trim: true,
      default: "",
    },
    rawAmount: {
      type: String,
      trim: true,
      default: "",
    },
    parsedDate: {
      type: Date,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    direction: {
      type: String,
      enum: importDirections,
      required: true,
    },
    suggestedClassification: {
      type: String,
      enum: importClassifications,
      default: "unclassified",
    },
    classification: {
      type: String,
      enum: importClassifications,
      default: "unclassified",
    },
    category: {
      type: String,
      trim: true,
      default: "",
    },
    linkedLiability: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Liability",
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    importHash: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    duplicateOfFingerprint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ImportedRecordFingerprint",
      default: null,
    },
    errorMessage: {
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
    revertedAt: {
      type: Date,
      default: null,
    },
    revertMessage: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: importRowStatuses,
      default: "needs_review",
      index: true,
    },
    importedRecordType: {
      type: String,
      trim: true,
      default: "",
    },
    importedRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true }
);

importRowSchema.index({ user: 1, importBatch: 1, createdAt: 1 });
importRowSchema.index({ importBatch: 1, status: 1 });

const ImportRow = mongoose.model("ImportRow", importRowSchema);

export default ImportRow;
