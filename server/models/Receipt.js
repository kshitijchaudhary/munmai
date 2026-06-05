import mongoose from "mongoose";

export const receiptStatuses = ["uploaded", "reviewed", "linked", "archived"];

const receiptSchema = new mongoose.Schema(
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
    storedFilename: {
      type: String,
      required: true,
      trim: true,
    },
    filePath: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 0,
    },
    fileExtension: {
      type: String,
      trim: true,
      default: "",
    },
    vendor: {
      type: String,
      trim: true,
      default: "",
    },
    amount: {
      type: Number,
      default: null,
      min: 0,
    },
    purchaseDate: {
      type: Date,
      default: null,
    },
    category: {
      type: String,
      trim: true,
      default: "Other",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    tags: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: receiptStatuses,
      default: "uploaded",
      index: true,
    },
    linkedExpense: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expense",
      default: null,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

receiptSchema.index({ user: 1, uploadedAt: -1 });
receiptSchema.index({ user: 1, status: 1 });
receiptSchema.index({ user: 1, purchaseDate: -1 });
receiptSchema.index({
  vendor: "text",
  notes: "text",
  originalFilename: "text",
  tags: "text",
});

const Receipt = mongoose.model("Receipt", receiptSchema);

export default Receipt;
