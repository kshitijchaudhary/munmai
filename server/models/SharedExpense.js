import mongoose from "mongoose";
import {
  isCanonicalMoneyAmount,
  MONEY_AMOUNT_SCHEMA_MESSAGE,
} from "../utils/moneyAmount.js";

const sharedExpenseSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      validate: {
        validator: isCanonicalMoneyAmount,
        message: MONEY_AMOUNT_SCHEMA_MESSAGE,
      },
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      maxLength: [128, "Idempotency key cannot exceed 128 characters"],
      select: false,
    },
    idempotencyParticipants: {
      type: [String],
      select: false,
    },
  },
  { timestamps: true }
);

sharedExpenseSchema.index({ group: 1, createdAt: -1 });
sharedExpenseSchema.index({ createdBy: 1, createdAt: -1 });
sharedExpenseSchema.index(
  { createdBy: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $exists: true, $type: "string" },
    },
  },
);

sharedExpenseSchema.set("toJSON", {
  transform: (_document, result) => {
    delete result.idempotencyKey;
    delete result.idempotencyParticipants;
    return result;
  },
});

const SharedExpense = mongoose.model("SharedExpense", sharedExpenseSchema);

export default SharedExpense;
