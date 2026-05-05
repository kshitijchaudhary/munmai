import mongoose from "mongoose";

const liabilityPaymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    liability: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Liability",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0.01, "Payment amount must be greater than 0"],
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
      maxLength: [500, "Payment note cannot exceed 500 characters"],
      default: "",
    },
  },
  { timestamps: true }
);

liabilityPaymentSchema.index({ user: 1, paymentDate: -1 });
liabilityPaymentSchema.index({ liability: 1, paymentDate: -1 });

const LiabilityPayment = mongoose.model(
  "LiabilityPayment",
  liabilityPaymentSchema
);

export default LiabilityPayment;
