import mongoose from "mongoose";
import {
  isCanonicalMoneyAmount,
  MONEY_AMOUNT_SCHEMA_MESSAGE,
} from "../utils/moneyAmount.js";

const settlementSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      validate: {
        validator(value) {
          return String(value) !== String(this.from);
        },
        message: "Settlement users must be different",
      },
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      validate: {
        validator: isCanonicalMoneyAmount,
        message: MONEY_AMOUNT_SCHEMA_MESSAGE,
      },
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

settlementSchema.index({ group: 1, createdAt: -1 });
settlementSchema.index({ recordedBy: 1, createdAt: -1 });

const Settlement = mongoose.model("Settlement", settlementSchema);

export default Settlement;
