import mongoose from "mongoose";

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
    },
  },
  { timestamps: true }
);

expenseSplitSchema.index({ expense: 1, user: 1 });

const ExpenseSplit = mongoose.model("ExpenseSplit", expenseSplitSchema);

export default ExpenseSplit;
