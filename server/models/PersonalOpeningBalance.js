import mongoose from "mongoose";

const personalOpeningBalanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, "Opening balance amount is required"],
      min: [0, "Opening balance cannot be negative"],
      default: 0,
    },
    asOfDate: {
      type: Date,
      default: null,
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

const PersonalOpeningBalance = mongoose.model(
  "PersonalOpeningBalance",
  personalOpeningBalanceSchema
);

export default PersonalOpeningBalance;
