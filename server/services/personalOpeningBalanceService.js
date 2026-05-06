import PersonalOpeningBalance from "../models/PersonalOpeningBalance.js";

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeOpeningBalancePayload = (payload = {}) => {
  if (
    payload.amount === undefined ||
    payload.amount === null ||
    String(payload.amount).trim() === ""
  ) {
    throw createHttpError(400, "Opening balance amount is required.");
  }

  const amount = Number(payload.amount);

  if (!Number.isFinite(amount) || amount < 0) {
    throw createHttpError(400, "Opening balance amount must be greater than or equal to 0.");
  }

  const asOfDate = payload.asOfDate ? new Date(payload.asOfDate) : null;

  if (asOfDate && Number.isNaN(asOfDate.getTime())) {
    throw createHttpError(400, "Please provide a valid as-of date.");
  }

  return {
    amount,
    asOfDate,
    notes: String(payload.notes || "").trim(),
  };
};

export const getPersonalOpeningBalance = async (userId) => {
  const openingBalance = await PersonalOpeningBalance.findOne({ user: userId });

  if (openingBalance) {
    return openingBalance;
  }

  return {
    amount: 0,
    asOfDate: null,
    notes: "",
  };
};

export const upsertPersonalOpeningBalance = async (userId, payload) => {
  const normalizedPayload = normalizeOpeningBalancePayload(payload);

  return PersonalOpeningBalance.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        ...normalizedPayload,
        user: userId,
      },
    },
    {
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      upsert: true,
    }
  );
};
