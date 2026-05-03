import mongoose from "mongoose";

const budgetSettingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    monthlySpendingLimit: {
      type: Number,
      required: true,
      min: [0, "Monthly spending limit cannot be negative"],
      default: 0,
    },
  },
  { timestamps: true }
);

const BudgetSetting = mongoose.model("BudgetSetting", budgetSettingSchema);

export default BudgetSetting;
