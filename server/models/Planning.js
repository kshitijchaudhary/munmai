import mongoose from "mongoose";
import { getPlanningDateValidationError } from "../utils/planningDate.js";
import { validatePlanningMoneyAmount } from "../utils/planningMoney.js";

export const PLANNING_CERTAINTIES = [
  "confirmed",
  "estimated",
  "unknown",
];
export const PLANNING_CATEGORIES = [
  "bill",
  "credit_card",
  "personal_debt",
  "other",
];

export const obligationRequiresKnownDetails = (certainty) =>
  certainty === "confirmed" || certainty === "estimated";

const requiresKnownObligationDetails = function () {
  return obligationRequiresKnownDetails(this.certainty);
};

const obligationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Obligation name is required."],
    trim: true,
    maxLength: [200, "Obligation name cannot exceed 200 characters."],
  },
  amount: {
    type: Number,
    default: null,
    required: [requiresKnownObligationDetails, "Obligation amount is required."],
    validate: {
      validator(value) {
        return value === null || value === undefined
          ? !requiresKnownObligationDetails.call(this)
          : validatePlanningMoneyAmount(value).valid;
      },
      message: "Obligation amount must be greater than 0, have no more than 2 decimal places, and not exceed $100,000,000.00.",
    },
  },
  dueDate: {
    type: String,
    default: null,
    required: [requiresKnownObligationDetails, "Obligation due date is required."],
    validate: {
      validator(value) {
        return value === null || value === undefined
          ? !requiresKnownObligationDetails.call(this)
          : getPlanningDateValidationError(value) === "";
      },
      message: "Obligation due date must use a valid YYYY-MM-DD calendar date.",
    },
  },
  certainty: {
    type: String,
    required: [true, "Obligation certainty is required."],
    enum: {
      values: PLANNING_CERTAINTIES,
      message: "Obligation certainty is invalid.",
    },
  },
  category: {
    type: String,
    required: [true, "Obligation category is required."],
    enum: {
      values: PLANNING_CATEGORIES,
      message: "Obligation category is invalid.",
    },
  },
  note: {
    type: String,
    trim: true,
    maxLength: [500, "Obligation note cannot exceed 500 characters."],
    default: "",
  },
});

const planningSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    currentCash: {
      type: Number,
      required: [true, "Current cash is required."],
      validate: {
        validator: (value) =>
          validatePlanningMoneyAmount(value, { allowZero: true }).valid,
        message: "Current cash must be 0 or more, have no more than 2 decimal places, and not exceed $100,000,000.00.",
      },
    },
    nextPayday: {
      type: String,
      required: [true, "Next payday is required."],
      validate: {
        validator: (value) => getPlanningDateValidationError(value) === "",
        message: "Next payday must use a valid YYYY-MM-DD calendar date.",
      },
    },
    essentialBuffer: {
      type: Number,
      required: [true, "Essential buffer is required."],
      validate: {
        validator: (value) =>
          validatePlanningMoneyAmount(value, { allowZero: true }).valid,
        message: "Essential buffer must be 0 or more, have no more than 2 decimal places, and not exceed $100,000,000.00.",
      },
    },
    obligations: {
      type: [obligationSchema],
      default: [],
    },
    currency: {
      type: String,
      enum: {
        values: ["CAD"],
        message: "Currency must be CAD.",
      },
      default: "CAD",
      required: true,
    },
  },
  { timestamps: true },
);

const Planning = mongoose.model("Planning", planningSchema);

export default Planning;
