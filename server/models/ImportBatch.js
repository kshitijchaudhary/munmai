import mongoose from "mongoose";

export const importBatchStatuses = [
  "pending_review",
  "partially_imported",
  "imported",
  "cancelled",
];

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
