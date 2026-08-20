import { PLANNING_CADENCES } from "../models/Planning.js";
import {
  comparePlanningDates,
  getNextPaydayValidationError,
  getPlanningDateValidationError,
  parsePlanningDate,
  toUtcPlanningDate,
} from "../utils/planningDate.js";

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const formatPlanningDate = (year, month, day) =>
  [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");

const daysInPlanningMonth = (year, month) => {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const firstOfNextMonth = new Date(
    `${formatPlanningDate(nextYear, nextMonth, 1)}T00:00:00.000Z`,
  );

  firstOfNextMonth.setUTCDate(0);
  return firstOfNextMonth.getUTCDate();
};

export const advancePlanningDueDate = (dueDate, cadence) => {
  const parsed = parsePlanningDate(dueDate);

  if (!parsed) {
    throw createHttpError(
      400,
      "Recurring due date must use a valid YYYY-MM-DD calendar date.",
    );
  }

  if (!PLANNING_CADENCES.includes(cadence)) {
    throw createHttpError(400, "Recurring cadence is invalid.");
  }

  if (cadence === "monthly") {
    const month = parsed.month === 12 ? 1 : parsed.month + 1;
    const year = parsed.month === 12 ? parsed.year + 1 : parsed.year;
    const day = Math.min(parsed.day, daysInPlanningMonth(year, month));

    return formatPlanningDate(year, month, day);
  }

  const date = new Date(`${dueDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + (cadence === "weekly" ? 7 : 14));
  return date.toISOString().slice(0, 10);
};

const prepareRecurringObligation = (obligation, asOfDate, warnings) => {
  if (obligation.amountType !== "fixed" && obligation.amountType !== "variable") {
    throw createHttpError(400, "Recurring amount type is invalid.");
  }

  if (!PLANNING_CADENCES.includes(obligation.cadence)) {
    throw createHttpError(400, "Recurring cadence is invalid.");
  }

  const dueDate =
    obligation.dueDate === null || obligation.dueDate === undefined
      ? null
      : advancePlanningDueDate(obligation.dueDate, obligation.cadence);

  if (dueDate && comparePlanningDates(dueDate, asOfDate) < 0) {
    warnings.push({
      code: "ROLLED_DATE_STILL_STALE",
      obligationName: obligation.name,
      message: `The next ${obligation.name} date may still be in the past. Review it before saving.`,
    });
  }

  const variable = obligation.amountType === "variable";

  return {
    amount: variable ? null : obligation.amount ?? null,
    amountType: obligation.amountType,
    cadence: obligation.cadence,
    category: obligation.category,
    certainty: variable ? "unknown" : obligation.certainty,
    dueDate,
    name: obligation.name,
    note: obligation.note ?? "",
    recurring: true,
  };
};

export const prepareNextPlanningCycle = (
  currentPlanning,
  { nextPayday, asOf = new Date() } = {},
) => {
  if (!currentPlanning || typeof currentPlanning !== "object") {
    throw createHttpError(400, "Current planning cycle is required.");
  }

  const paydayError = getNextPaydayValidationError(nextPayday, { now: asOf });

  if (paydayError) {
    throw createHttpError(400, `Next payday: ${paydayError}`);
  }

  if (
    getPlanningDateValidationError(currentPlanning.nextPayday) === "" &&
    comparePlanningDates(nextPayday, currentPlanning.nextPayday) <= 0
  ) {
    throw createHttpError(
      400,
      "Next payday must be after the current planning cycle payday.",
    );
  }

  const warnings = [];
  const asOfDate = toUtcPlanningDate(asOf);
  const obligations = Array.isArray(currentPlanning.obligations)
    ? currentPlanning.obligations
        .filter((obligation) => obligation.recurring === true)
        .map((obligation) =>
          prepareRecurringObligation(obligation, asOfDate, warnings),
        )
    : [];

  return {
    planning: {
      currentCash: null,
      currency: "CAD",
      essentialBuffer: currentPlanning.essentialBuffer ?? 0,
      nextPayday,
      obligations,
    },
    warnings,
  };
};
