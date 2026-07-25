import mongoose from "mongoose";
import {
  isCanonicalMoneyAmount,
  MONEY_AMOUNT_SCHEMA_MESSAGE,
} from "../utils/moneyAmount.js";

const expenseSplitSchema = new mongoose.Schema(
  {
    expense: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SharedExpense",
      required: true,
      index: true,
    },
    user: {
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
  },
  { timestamps: true }
);

expenseSplitSchema.index({ expense: 1, user: 1 });

const ExpenseSplit = mongoose.model("ExpenseSplit", expenseSplitSchema);

export default ExpenseSplit;
