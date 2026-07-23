export const MAX_MONEY_AMOUNT = 100_000_000;

export const MONEY_AMOUNT_TYPE_MESSAGE = "Amount must be a number.";
export const MONEY_AMOUNT_FINITE_MESSAGE = "Amount must be finite.";
export const MONEY_AMOUNT_POSITIVE_MESSAGE = "Amount must be greater than 0.";
export const MONEY_AMOUNT_MIN_MESSAGE = "Amount must be at least $0.01.";
export const MONEY_AMOUNT_PRECISION_MESSAGE =
  "Amount must have no more than 2 decimal places.";
export const MONEY_AMOUNT_MAX_MESSAGE =
  "Amount must not exceed $100,000,000.00.";
export const MONEY_AMOUNT_SCHEMA_MESSAGE =
  "Amount must be at least $0.01, have no more than 2 decimal places, and not exceed $100,000,000.00.";

const MULTIPART_AMOUNT_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

const hasCanonicalCentPrecision = (amount) => {
  const nearestCent = Math.round(amount * 100);
  return (
    Number.isSafeInteger(nearestCent) &&
    amount === nearestCent / 100
  );
};

const parseMultipartAmount = (value) => {
  const normalized = value.trim();

  if (!MULTIPART_AMOUNT_PATTERN.test(normalized)) {
    return { error: MONEY_AMOUNT_TYPE_MESSAGE };
  }

  return {
    amount: Number(normalized),
    hasTooManyDecimals: (normalized.split(".")[1] || "").length > 2,
  };
};

export const validateMoneyAmount = (
  value,
  { allowMultipartString = false } = {},
) => {
  let amount = value;
  let hasTooManyDecimals = false;

  if (
    allowMultipartString &&
    typeof value === "string"
  ) {
    const parsed = parseMultipartAmount(value);

    if (parsed.error) {
      return { error: parsed.error, valid: false };
    }

    amount = parsed.amount;
    hasTooManyDecimals = parsed.hasTooManyDecimals;
  } else if (typeof value !== "number") {
    return { error: MONEY_AMOUNT_TYPE_MESSAGE, valid: false };
  }

  if (!Number.isFinite(amount)) {
    return { error: MONEY_AMOUNT_FINITE_MESSAGE, valid: false };
  }

  if (amount <= 0) {
    return { error: MONEY_AMOUNT_POSITIVE_MESSAGE, valid: false };
  }

  if (amount < 0.01) {
    return { error: MONEY_AMOUNT_MIN_MESSAGE, valid: false };
  }

  if (hasTooManyDecimals || !hasCanonicalCentPrecision(amount)) {
    return { error: MONEY_AMOUNT_PRECISION_MESSAGE, valid: false };
  }

  if (amount > MAX_MONEY_AMOUNT) {
    return { error: MONEY_AMOUNT_MAX_MESSAGE, valid: false };
  }

  return { amount, error: "", valid: true };
};

export const isCanonicalMoneyAmount = (value) =>
  validateMoneyAmount(value).valid;
