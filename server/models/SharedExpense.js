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
  },
  { timestamps: true }
);

sharedExpenseSchema.index({ group: 1, createdAt: -1 });
sharedExpenseSchema.index({ createdBy: 1, createdAt: -1 });

const SharedExpense = mongoose.model("SharedExpense", sharedExpenseSchema);

export default SharedExpense;
