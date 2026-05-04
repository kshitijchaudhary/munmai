import mongoose from "mongoose";

export const liabilityTypes = ["friend", "credit_card", "loan", "bill", "other"];
export const liabilityStatuses = ["active", "paid"];

const liabilitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    creditorName: {
      type: String,
      required: [true, "Creditor name is required"],
      trim: true,
      maxLength: [120, "Creditor name cannot exceed 120 characters"],
    },
    liabilityType: {
      type: String,
      enum: liabilityTypes,
      required: [true, "Debt type is required"],
    },
    originalAmount: {
      type: Number,
      required: [true, "Original amount is required"],
      min: [0, "Original amount cannot be negative"],
    },
    currentBalance: {
      type: Number,
      required: [true, "Current balance is required"],
      min: [0, "Current balance cannot be negative"],
    },
    dueDate: {
      type: Date,
      default: null,
    },
    minimumPayment: {
      type: Number,
      min: [0, "Minimum payment cannot be negative"],
      default: 0,
    },
    plannedMonthlyPayment: {
      type: Number,
      min: [0, "Planned monthly payment cannot be negative"],
      default: 0,
    },
    status: {
      type: String,
      enum: liabilityStatuses,
      default: "active",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxLength: [500, "Notes cannot exceed 500 characters"],
      default: "",
    },
  },
  { timestamps: true }
);

liabilitySchema.index({ user: 1, status: 1, dueDate: 1 });
liabilitySchema.index({ user: 1, liabilityType: 1 });

const Liability = mongoose.model("Liability", liabilitySchema);

export default Liability;
