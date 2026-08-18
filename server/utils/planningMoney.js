import {
  MONEY_AMOUNT_POSITIVE_MESSAGE,
  validateMoneyAmount,
} from "./moneyAmount.js";

export const PLANNING_MONEY_NON_NEGATIVE_MESSAGE =
  "Amount must be greater than or equal to 0.";

export const validatePlanningMoneyAmount = (
  value,
  { allowZero = false } = {},
) => {
  if (allowZero && value === 0) {
    return { amount: 0, error: "", valid: true };
  }

  const result = validateMoneyAmount(value);

  if (allowZero && result.error === MONEY_AMOUNT_POSITIVE_MESSAGE) {
    return {
      error: PLANNING_MONEY_NON_NEGATIVE_MESSAGE,
      valid: false,
    };
  }

  return result;
};

export const isPlanningMoneyAmount = (value, options) =>
  validatePlanningMoneyAmount(value, options).valid;
