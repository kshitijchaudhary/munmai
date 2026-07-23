export const MAX_MONEY_AMOUNT = 100_000_000;

export const MONEY_AMOUNT_REQUIRED_MESSAGE = 'Amount is required.';
export const MONEY_AMOUNT_NUMBER_MESSAGE = 'Amount must be a number.';
export const MONEY_AMOUNT_POSITIVE_MESSAGE = 'Amount must be greater than 0.';
export const MONEY_AMOUNT_MIN_MESSAGE = 'Amount must be at least $0.01.';
export const MONEY_AMOUNT_PRECISION_MESSAGE =
  'Amount must have no more than 2 decimal places.';
export const MONEY_AMOUNT_MAX_MESSAGE =
  'Amount must not exceed $100,000,000.00.';

const DECIMAL_AMOUNT_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

/**
 * @param {string} value
 * @returns {string | null}
 */
export function getMoneyAmountInputError(value) {
  const normalized = value.trim();

  if (!normalized) {
    return MONEY_AMOUNT_REQUIRED_MESSAGE;
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount)) {
    return MONEY_AMOUNT_NUMBER_MESSAGE;
  }

  if (amount <= 0) {
    return MONEY_AMOUNT_POSITIVE_MESSAGE;
  }

  if (amount < 0.01) {
    return MONEY_AMOUNT_MIN_MESSAGE;
  }

  if (!DECIMAL_AMOUNT_PATTERN.test(normalized)) {
    return MONEY_AMOUNT_NUMBER_MESSAGE;
  }

  const fraction = normalized.split('.')[1] || '';

  if (fraction.length > 2) {
    return MONEY_AMOUNT_PRECISION_MESSAGE;
  }

  if (amount > MAX_MONEY_AMOUNT) {
    return MONEY_AMOUNT_MAX_MESSAGE;
  }

  return null;
}

/**
 * @param {string} value
 * @returns {number | null}
 */
export function parseMoneyAmountInput(value) {
  return getMoneyAmountInputError(value) ? null : Number(value.trim());
}
