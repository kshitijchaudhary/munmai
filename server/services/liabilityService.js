import mongoose from "mongoose";
import Liability, { liabilityStatuses, liabilityTypes } from "../models/Liability.js";

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeOptionalAmount = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw createError(`${fieldName} must be a number greater than or equal to 0`, 400);
  }

  return roundMoney(amount);
};

const normalizeRequiredAmount = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    throw createError(`${fieldName} is required`, 400);
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw createError(`${fieldName} must be a number greater than or equal to 0`, 400);
  }

  return roundMoney(amount);
};

const normalizeDueDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createError("Due date must be a valid date", 400);
  }

  return date;
};

const getPaymentPressureAmount = (liability) => {
  const plannedPayment = Number(liability.plannedMonthlyPayment || 0);
  const minimumPayment = Number(liability.minimumPayment || 0);

  return plannedPayment > 0 ? plannedPayment : minimumPayment;
};

const normalizeLiabilityPayload = (payload, { partial = false } = {}) => {
  const updates = {};

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "creditorName")) {
    const creditorName = String(payload.creditorName || "").trim();

    if (!creditorName) {
      throw createError("Creditor name is required", 400);
    }

    updates.creditorName = creditorName;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "liabilityType")) {
    const liabilityType = String(payload.liabilityType || "").trim();

    if (!liabilityTypes.includes(liabilityType)) {
      throw createError("Debt type is invalid", 400);
    }

    updates.liabilityType = liabilityType;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "originalAmount")) {
    updates.originalAmount = normalizeRequiredAmount(
      payload.originalAmount,
      "Original amount"
    );
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "currentBalance")) {
    updates.currentBalance = normalizeRequiredAmount(
      payload.currentBalance,
      "Current balance"
    );
  }

  if (Object.prototype.hasOwnProperty.call(payload, "minimumPayment")) {
    updates.minimumPayment = normalizeOptionalAmount(
      payload.minimumPayment,
      "Minimum payment"
    );
  } else if (!partial) {
    updates.minimumPayment = 0;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "plannedMonthlyPayment")) {
    updates.plannedMonthlyPayment = normalizeOptionalAmount(
      payload.plannedMonthlyPayment,
      "Planned monthly payment"
    );
  } else if (!partial) {
    updates.plannedMonthlyPayment = 0;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "dueDate")) {
    updates.dueDate = normalizeDueDate(payload.dueDate);
  } else if (!partial) {
    updates.dueDate = null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    const status = String(payload.status || "").trim();

    if (!liabilityStatuses.includes(status)) {
      throw createError("Debt status is invalid", 400);
    }

    updates.status = status;
  } else if (!partial) {
    updates.status = "active";
  }

  if (Object.prototype.hasOwnProperty.call(payload, "notes")) {
    updates.notes = String(payload.notes || "").trim();
  } else if (!partial) {
    updates.notes = "";
  }

  return updates;
};

const assertValidObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(String(id || ""))) {
    throw createError("Invalid debt ID", 400);
  }
};

export const listLiabilities = async (userId, filters = {}) => {
  const query = { user: userId };

  if (filters.status) {
    if (!liabilityStatuses.includes(filters.status)) {
      throw createError("Debt status is invalid", 400);
    }

    query.status = filters.status;
  }

  if (filters.liabilityType) {
    if (!liabilityTypes.includes(filters.liabilityType)) {
      throw createError("Debt type is invalid", 400);
    }

    query.liabilityType = filters.liabilityType;
  }

  return Liability.find(query).sort({ status: 1, dueDate: 1, createdAt: -1 });
};

export const createLiability = async (userId, payload) => {
  const normalizedPayload = normalizeLiabilityPayload(payload);
  return Liability.create({ ...normalizedPayload, user: userId });
};

export const updateLiability = async (userId, liabilityId, payload) => {
  assertValidObjectId(liabilityId);

  const updates = normalizeLiabilityPayload(payload, { partial: true });

  if (updates.status === "paid") {
    updates.currentBalance = 0;
  }

  const liability = await Liability.findOneAndUpdate(
    { _id: liabilityId, user: userId },
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!liability) {
    throw createError("Debt not found", 404);
  }

  return liability;
};

export const deleteLiability = async (userId, liabilityId) => {
  assertValidObjectId(liabilityId);

  const liability = await Liability.findOneAndDelete({
    _id: liabilityId,
    user: userId,
  });

  if (!liability) {
    throw createError("Debt not found", 404);
  }

  return { message: "Debt deleted" };
};

export const getLiabilitySummary = async (userId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueSoonEndDate = new Date(today);
  dueSoonEndDate.setDate(dueSoonEndDate.getDate() + 7);
  dueSoonEndDate.setHours(23, 59, 59, 999);

  const liabilities = await Liability.find({ user: userId }).lean();
  const activeLiabilities = liabilities.filter(
    (liability) => liability.status === "active"
  );
  const paidLiabilities = liabilities.filter((liability) => liability.status === "paid");
  const dueSoonLiabilities = activeLiabilities.filter((liability) => {
    if (!liability.dueDate) {
      return false;
    }

    const dueDate = new Date(liability.dueDate);
    return dueDate >= today && dueDate <= dueSoonEndDate;
  });
  const highestBalanceLiability =
    activeLiabilities
      .slice()
      .sort((a, b) => Number(b.currentBalance || 0) - Number(a.currentBalance || 0))[0] ||
    null;

  return {
    totalActiveDebt: roundMoney(
      activeLiabilities.reduce(
        (sum, liability) => sum + Number(liability.currentBalance || 0),
        0
      )
    ),
    totalPaidDebt: roundMoney(
      paidLiabilities.reduce(
        (sum, liability) => sum + Number(liability.originalAmount || 0),
        0
      )
    ),
    activeCount: activeLiabilities.length,
    paidCount: paidLiabilities.length,
    dueSoonCount: dueSoonLiabilities.length,
    dueSoonAmount: roundMoney(
      dueSoonLiabilities.reduce(
        (sum, liability) =>
          sum + (getPaymentPressureAmount(liability) || Number(liability.currentBalance || 0)),
        0
      )
    ),
    monthlyDebtPressure: roundMoney(
      activeLiabilities.reduce(
        (sum, liability) => sum + getPaymentPressureAmount(liability),
        0
      )
    ),
    highestBalanceLiability,
  };
};
