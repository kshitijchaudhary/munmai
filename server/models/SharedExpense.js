import mongoose from "mongoose";

const hasUniqueIds = (values = []) => {
  const normalizedValues = values.map((value) => String(value));
  return normalizedValues.length === new Set(normalizedValues).size;
};
const hasMaxTwoDecimalPlaces = (value) =>
  Math.abs(Number(value) * 100 - Math.round(Number(value) * 100)) < 1e-9;

const sharedExpenseSchema = new mongoose.Schema(
  {
    groupId: {
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
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      required: true,
      validate: [
        {
          validator: (value) => Array.isArray(value) && value.length > 0,
          message: "At least one participant is required",
        },
        {
          validator: hasUniqueIds,
          message: "Participants must be unique",
        },
      ],
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
    description: {
      type: String,
      trim: true,
      maxLength: [300, "Description cannot exceed 300 characters"],
      default: "",
    },
    splitType: {
      type: String,
      enum: ["equal"],
      default: "equal",
    },
    expenseDate: {
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

sharedExpenseSchema.index({ groupId: 1, expenseDate: -1, createdAt: -1 });
sharedExpenseSchema.index({ createdBy: 1, createdAt: -1 });

const SharedExpense = mongoose.model("SharedExpense", sharedExpenseSchema);

export default SharedExpense;
