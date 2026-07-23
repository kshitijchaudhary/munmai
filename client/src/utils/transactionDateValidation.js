export const TRANSACTION_DATE_FUTURE_MESSAGE =
  "Transaction date cannot be in the future.";
export const TRANSACTION_DATE_INVALID_MESSAGE =
  "Please provide a valid transaction date.";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/;
const ISO_DATE_PREFIX_PATTERN = /^\d{4}-\d{2}-\d{2}/;
const SLASH_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

const isLeapYear = (year) =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const getDaysInMonth = (year, month) =>
  [
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
  ][month - 1] || 0;

const isValidDateOnly = (value) => {
  const match = String(value || "").match(DATE_ONLY_PATTERN);

  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return (
    year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= getDaysInMonth(year, month)
  );
};

const padDatePart = (value) => String(value).padStart(2, "0");

const getValidatedDateValue = (year, month, day) => {
  const value = `${String(year).padStart(4, "0")}-${padDatePart(
    month
  )}-${padDatePart(day)}`;

  return isValidDateOnly(value) ? value : "";
};

export const getLocalDateValue = (date = new Date()) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(
    date.getDate()
  )}`;

export const normalizeTransactionDateValue = (value) => {
  const normalized = String(value || "").trim();
  const dateOnlyMatch = normalized.match(DATE_ONLY_PATTERN);

  if (dateOnlyMatch) {
    return getValidatedDateValue(
      dateOnlyMatch[1],
      dateOnlyMatch[2],
      dateOnlyMatch[3]
    );
  }

  const isoDateTimeMatch = normalized.match(ISO_DATE_TIME_PATTERN);

  if (isoDateTimeMatch) {
    const dateValue = getValidatedDateValue(
      isoDateTimeMatch[1],
      isoDateTimeMatch[2],
      isoDateTimeMatch[3]
    );

    return dateValue && !Number.isNaN(new Date(normalized).getTime())
      ? dateValue
      : "";
  }

  if (ISO_DATE_PREFIX_PATTERN.test(normalized)) {
    return "";
  }

  const slashMatch = normalized.match(SLASH_DATE_PATTERN);

  if (slashMatch) {
    return getValidatedDateValue(slashMatch[3], slashMatch[1], slashMatch[2]);
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? "" : getLocalDateValue(date);
};

export const getTransactionDateValidationError = (
  value,
  { allowFlexibleFormat = false, now = new Date() } = {}
) => {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return "Date is required";
  }

  const dateValue = allowFlexibleFormat
    ? normalizeTransactionDateValue(normalized)
    : isValidDateOnly(normalized)
    ? normalized
    : "";

  if (!dateValue) {
    return TRANSACTION_DATE_INVALID_MESSAGE;
  }

  return dateValue > getLocalDateValue(now)
    ? TRANSACTION_DATE_FUTURE_MESSAGE
    : "";
};

export const submitWithTransactionDateGuard = async ({
  date,
  now,
  submit,
}) => {
  const message = getTransactionDateValidationError(date, { now });

  if (message) {
    return { message, submitted: false };
  }

  const value = await submit();
  return { message: "", submitted: true, value };
};

export const submitWithTransactionDateBatchGuard = async ({
  allowFlexibleFormat = false,
  entries,
  getDate = (entry) => entry?.date,
  now,
  submit,
}) => {
  for (const entry of entries) {
    const message = getTransactionDateValidationError(getDate(entry), {
      allowFlexibleFormat,
      now,
    });

    if (message) {
      return { message, rejectedEntry: entry, submitted: false };
    }
  }

  const value = await submit();
  return { message: "", rejectedEntry: null, submitted: true, value };
};
