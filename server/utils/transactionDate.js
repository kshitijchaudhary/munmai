export const INVALID_TRANSACTION_DATE_MESSAGE = "Please provide a valid date";
export const FUTURE_TRANSACTION_DATE_MESSAGE =
  "Transaction date cannot be in the future.";

const ISO_TRANSACTION_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?)?$/;
const ISO_DATE_TIME_PREFIX_PATTERN = /^\d{4}-\d{2}-\d{2}T/;

const isLeapYear = (year) =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const daysInMonth = (year, month) => {
  const monthLengths = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return monthLengths[month - 1] || 0;
};

const isValidCalendarDate = (year, month, day) =>
  year >= 1 &&
  month >= 1 &&
  month <= 12 &&
  day >= 1 &&
  day <= daysInMonth(year, month);

const toCalendarKey = (year, month, day) =>
  year * 10_000 + month * 100 + day;

const dateToUtcCalendarKey = (date) =>
  toCalendarKey(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );

const parseTransactionDateInput = (value, allowFlexibleStrings) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : { calendarKey: dateToUtcCalendarKey(value), date: value };
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? null
      : { calendarKey: dateToUtcCalendarKey(date), date };
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const calendarMatch = normalized.match(ISO_TRANSACTION_DATE_PATTERN);

  if (calendarMatch) {
    const year = Number(calendarMatch[1]);
    const month = Number(calendarMatch[2]);
    const day = Number(calendarMatch[3]);

    if (!isValidCalendarDate(year, month, day)) {
      return null;
    }

    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return {
      calendarKey: dateToUtcCalendarKey(date),
      date,
    };
  }

  if (!allowFlexibleStrings || ISO_DATE_TIME_PREFIX_PATTERN.test(normalized)) {
    return null;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime())
    ? null
    : { calendarKey: dateToUtcCalendarKey(date), date };
};

export const getTransactionDateValidationError = (
  value,
  { allowFlexibleStrings = false, now = new Date() } = {},
) => {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  const parsed = parseTransactionDateInput(value, allowFlexibleStrings);

  if (!parsed || Number.isNaN(now.getTime())) {
    return INVALID_TRANSACTION_DATE_MESSAGE;
  }

  return parsed.calendarKey > dateToUtcCalendarKey(now)
    ? FUTURE_TRANSACTION_DATE_MESSAGE
    : "";
};

export const isTransactionDateInFuture = (value, now = new Date()) =>
  getTransactionDateValidationError(value, {
    allowFlexibleStrings: true,
    now,
  }) === FUTURE_TRANSACTION_DATE_MESSAGE;
