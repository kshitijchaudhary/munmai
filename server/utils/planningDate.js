export const INVALID_PLANNING_DATE_MESSAGE =
  "Date must use a valid YYYY-MM-DD calendar date.";
export const PAST_NEXT_PAYDAY_MESSAGE =
  "Next payday must be today or a future date.";

const PLANNING_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

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

const toCalendarKey = (year, month, day) =>
  year * 10_000 + month * 100 + day;

export const parsePlanningDate = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(PLANNING_DATE_PATTERN);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return null;
  }

  return {
    calendarKey: toCalendarKey(year, month, day),
    day,
    month,
    value,
    year,
  };
};

export const isPlanningDate = (value) => parsePlanningDate(value) !== null;

export const comparePlanningDates = (left, right) => {
  const parsedLeft = parsePlanningDate(left);
  const parsedRight = parsePlanningDate(right);

  if (!parsedLeft || !parsedRight) {
    throw new TypeError(INVALID_PLANNING_DATE_MESSAGE);
  }

  return Math.sign(parsedLeft.calendarKey - parsedRight.calendarKey);
};

export const toUtcPlanningDate = (date = new Date()) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError(INVALID_PLANNING_DATE_MESSAGE);
  }

  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
};

export const getPlanningDateValidationError = (value) =>
  isPlanningDate(value) ? "" : INVALID_PLANNING_DATE_MESSAGE;

export const getNextPaydayValidationError = (
  value,
  { now = new Date() } = {},
) => {
  const dateError = getPlanningDateValidationError(value);

  if (dateError) {
    return dateError;
  }

  let today;

  try {
    today = toUtcPlanningDate(now);
  } catch {
    return INVALID_PLANNING_DATE_MESSAGE;
  }

  return comparePlanningDates(value, today) < 0
    ? PAST_NEXT_PAYDAY_MESSAGE
    : "";
};
