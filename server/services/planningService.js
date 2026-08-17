import mongoose from "mongoose";
import Planning, {
  obligationRequiresKnownDetails,
  PLANNING_CATEGORIES,
  PLANNING_CERTAINTIES,
} from "../models/Planning.js";
import {
  getNextPaydayValidationError,
  getPlanningDateValidationError,
} from "../utils/planningDate.js";
import { validatePlanningMoneyAmount } from "../utils/planningMoney.js";

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const requireField = (payload, field, label) => {
  if (!hasValue(payload[field])) {
    throw createHttpError(400, `${label} is required.`);
  }

  return payload[field];
};

const normalizeMoney = (value, label, { allowZero = false } = {}) => {
  const result = validatePlanningMoneyAmount(value, { allowZero });

  if (!result.valid) {
    throw createHttpError(400, `${label}: ${result.error}`);
  }

  return result.amount;
};

const normalizeOptionalString = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const normalizeObligationId = (value, prefix) => {
  if (value === undefined || value === null) {
    return new mongoose.Types.ObjectId();
  }

  if (!mongoose.isObjectIdOrHexString(value)) {
    throw createHttpError(400, `${prefix} ID is invalid.`);
  }

  return value;
};

const normalizeObligation = (obligation, index) => {
  if (!obligation || typeof obligation !== "object" || Array.isArray(obligation)) {
    throw createHttpError(400, `Obligation ${index + 1} must be an object.`);
  }

  const prefix = `Obligation ${index + 1}`;
  const _id = normalizeObligationId(obligation._id, prefix);
  const name = normalizeOptionalString(obligation.name);

  if (!name) {
    throw createHttpError(400, `${prefix} name is required.`);
  }

  if (name.length > 200) {
    throw createHttpError(400, `${prefix} name cannot exceed 200 characters.`);
  }

  const certainty = requireField(obligation, "certainty", `${prefix} certainty`);

  if (!PLANNING_CERTAINTIES.includes(certainty)) {
    throw createHttpError(400, `${prefix} certainty is invalid.`);
  }

  const category = requireField(obligation, "category", `${prefix} category`);

  if (!PLANNING_CATEGORIES.includes(category)) {
    throw createHttpError(400, `${prefix} category is invalid.`);
  }

  const requiresDetails = obligationRequiresKnownDetails(certainty);
  const amountProvided = hasValue(obligation.amount);
  const dueDateProvided = hasValue(obligation.dueDate);

  if (requiresDetails && !amountProvided) {
    throw createHttpError(400, `${prefix} amount is required.`);
  }

  if (requiresDetails && !dueDateProvided) {
    throw createHttpError(400, `${prefix} due date is required.`);
  }

  const amount = amountProvided
    ? normalizeMoney(obligation.amount, `${prefix} amount`)
    : null;
  const dueDate = dueDateProvided ? obligation.dueDate : null;

  if (dueDate !== null) {
    const dateError = getPlanningDateValidationError(dueDate);

    if (dateError) {
      throw createHttpError(400, `${prefix} due date: ${dateError}`);
    }
  }

  const note = normalizeOptionalString(obligation.note);

  if (note.length > 500) {
    throw createHttpError(400, `${prefix} note cannot exceed 500 characters.`);
  }

  const normalized = {
    _id,
    amount,
    category,
    certainty,
    dueDate,
    name,
    note,
  };

  return normalized;
};

export const normalizePlanningPayload = (payload = {}, { now = new Date() } = {}) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createHttpError(400, "Planning data must be an object.");
  }

  const currentCash = normalizeMoney(
    requireField(payload, "currentCash", "Current cash"),
    "Current cash",
    { allowZero: true },
  );
  const nextPayday = requireField(payload, "nextPayday", "Next payday");
  const paydayError = getNextPaydayValidationError(nextPayday, { now });

  if (paydayError) {
    throw createHttpError(400, `Next payday: ${paydayError}`);
  }

  const essentialBuffer = normalizeMoney(
    requireField(payload, "essentialBuffer", "Essential buffer"),
    "Essential buffer",
    { allowZero: true },
  );

  const obligations = payload.obligations ?? [];

  if (!Array.isArray(obligations)) {
    throw createHttpError(400, "Obligations must be an array.");
  }

  const currency = payload.currency ?? "CAD";

  if (currency !== "CAD") {
    throw createHttpError(400, "Currency must be CAD.");
  }

  const normalizedObligations = obligations.map(normalizeObligation);
  const obligationIds = new Set();

  normalizedObligations.forEach((obligation) => {
    const obligationId = String(obligation._id).toLowerCase();

    if (obligationIds.has(obligationId)) {
      throw createHttpError(400, "Obligation IDs must be unique.");
    }

    obligationIds.add(obligationId);
  });

  return {
    currentCash,
    currency: "CAD",
    essentialBuffer,
    nextPayday,
    obligations: normalizedObligations,
  };
};

export const getPlanning = async (userId) => {
  const planning = await Planning.findOne({ user: userId }).lean();

  return planning || {
    currentCash: 0,
    currency: "CAD",
    essentialBuffer: 0,
    nextPayday: null,
    obligations: [],
  };
};

export const upsertPlanning = async (userId, payload) => {
  const normalizedPayload = normalizePlanningPayload(payload);
  const update = {
    $set: {
      ...normalizedPayload,
      user: userId,
    },
  };
  const options = {
    new: true,
    runValidators: true,
    setDefaultsOnInsert: true,
    upsert: true,
  };

  try {
    return await Planning.findOneAndUpdate({ user: userId }, update, options);
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    return Planning.findOneAndUpdate(
      { user: userId },
      update,
      { ...options, upsert: false },
    );
  }
};
