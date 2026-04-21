import mongoose from "mongoose";
const hasMaxTwoDecimalPlaces = (value) =>
  Math.abs(Number(value) * 100 - Math.round(Number(value) * 100)) < 1e-9;

const settlementSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      validate: {
        validator: function (value) {
          return String(value) !== String(this.fromUser);
        },
        message: "Settlement users must be different",
      },
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than 0"],
      validate: {
        validator: hasMaxTwoDecimalPlaces,
        message: "Amount cannot have more than 2 decimal places",
      },
    },
    note: {
      type: String,
      trim: true,
      maxLength: [300, "Note cannot exceed 300 characters"],
      default: "",
    },
    settlementDate: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

settlementSchema.index({ groupId: 1, settlementDate: -1, createdAt: -1 });
settlementSchema.index({ createdBy: 1, createdAt: -1 });

const Settlement = mongoose.model("Settlement", settlementSchema);

export default Settlement;
