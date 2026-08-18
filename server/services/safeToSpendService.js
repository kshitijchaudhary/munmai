import { getSavedPlanning } from "./planningService.js";
import {
  comparePlanningDates,
  getPlanningDateValidationError,
  toUtcPlanningDate,
} from "../utils/planningDate.js";
import { validatePlanningMoneyAmount } from "../utils/planningMoney.js";

const CONFIDENCE = {
  ESTIMATED: "estimated",
  HIGH: "high",
  INCOMPLETE: "incomplete",
};

const toCents = (amount) => Math.round(amount * 100);
const fromCents = (amount) => amount / 100;

const getObligationId = (obligation) =>
  obligation?._id === undefined || obligation?._id === null
    ? null
    : String(obligation._id);

const getObligationName = (obligation) =>
  String(obligation?.name || "Unnamed obligation").trim();

const createWarning = (code, message, obligation = null) => ({
  code,
  ...(obligation ? { obligationId: getObligationId(obligation) } : {}),
  message,
});

const normalizeRequiredMoney = (value, warningCode, warningMessage, warnings) => {
  const result = validatePlanningMoneyAmount(value, { allowZero: true });

  if (!result.valid) {
    warnings.push(createWarning(warningCode, warningMessage));
    return null;
  }

  return result.amount;
};

const normalizeObligationMoney = (value) => {
  const result = validatePlanningMoneyAmount(value);
  return result.valid ? result.amount : null;
};

const normalizeObligationDate = (value) =>
  getPlanningDateValidationError(value) === "" ? value : null;

const buildObligationBreakdown = ({
  obligation,
  nextPayday,
  warnings,
}) => {
  const amount = normalizeObligationMoney(obligation?.amount);
  const dueDate = normalizeObligationDate(obligation?.dueDate);
  const certainty = obligation?.certainty || "unknown";
  const name = getObligationName(obligation);
  const base = {
    id: getObligationId(obligation),
    name,
    amount,
    dueDate,
    certainty,
    category: obligation?.category || "other",
    included: false,
    exclusionReason: null,
  };

  if (!nextPayday) {
    return { ...base, exclusionReason: "MISSING_NEXT_PAYDAY" };
  }

  if (certainty === "unknown") {
    if (!dueDate) {
      warnings.push(
        createWarning(
          "UNKNOWN_OBLIGATION_DATE",
          `${name} has no usable due date and is not included in Safe to Spend.`,
          obligation,
        ),
      );

      if (amount === null) {
        warnings.push(
          createWarning(
            "UNKNOWN_OBLIGATION_AMOUNT",
            `${name} has no usable amount and is not included in Safe to Spend.`,
            obligation,
          ),
        );
      }

      return { ...base, exclusionReason: "UNKNOWN_DATE" };
    }

    if (comparePlanningDates(dueDate, nextPayday) > 0) {
      return { ...base, exclusionReason: "AFTER_NEXT_PAYDAY" };
    }

    if (amount === null) {
      warnings.push(
        createWarning(
          "UNKNOWN_OBLIGATION_AMOUNT",
          `${name} has no usable amount and is not included in Safe to Spend.`,
          obligation,
        ),
      );
      return { ...base, exclusionReason: "UNKNOWN_AMOUNT" };
    }

    warnings.push(
      createWarning(
        "UNKNOWN_OBLIGATION_CERTAINTY",
        `${name} remains unknown and its amount is not included in Safe to Spend.`,
        obligation,
      ),
    );
    return { ...base, exclusionReason: "UNKNOWN_CERTAINTY" };
  }

  if (!dueDate) {
    warnings.push(
      createWarning(
        "INVALID_OBLIGATION_DATE",
        `${name} has no usable due date and is not included in Safe to Spend.`,
        obligation,
      ),
    );
    return { ...base, exclusionReason: "INVALID_DATE" };
  }

  if (comparePlanningDates(dueDate, nextPayday) > 0) {
    return { ...base, exclusionReason: "AFTER_NEXT_PAYDAY" };
  }

  if (amount === null) {
    warnings.push(
      createWarning(
        "INVALID_OBLIGATION_AMOUNT",
        `${name} has no usable amount and is not included in Safe to Spend.`,
        obligation,
      ),
    );
    return { ...base, exclusionReason: "INVALID_AMOUNT" };
  }

  return { ...base, included: true };
};

export const calculateSafeToSpend = (planningState, { asOf } = {}) => {
  if (getPlanningDateValidationError(asOf)) {
    throw new TypeError("Safe-to-Spend asOf must be a valid YYYY-MM-DD date.");
  }

  const warnings = [];
  const currentCash = normalizeRequiredMoney(
    planningState?.currentCash,
    "MISSING_CURRENT_CASH",
    "Current cash is missing or unusable.",
    warnings,
  );
  const essentialBuffer = normalizeRequiredMoney(
    planningState?.essentialBuffer,
    "MISSING_ESSENTIAL_BUFFER",
    "Essential buffer is missing or unusable.",
    warnings,
  );
  const submittedNextPayday = normalizeObligationDate(planningState?.nextPayday);
  const nextPayday =
    submittedNextPayday &&
    comparePlanningDates(submittedNextPayday, asOf) >= 0
      ? submittedNextPayday
      : null;

  if (!nextPayday) {
    warnings.push(
      createWarning(
        "MISSING_NEXT_PAYDAY",
        "Next payday is missing, unusable, or before the calculation date.",
      ),
    );
  }

  const obligationBreakdown = Array.isArray(planningState?.obligations)
    ? planningState.obligations.map((obligation) =>
        buildObligationBreakdown({ obligation, nextPayday, warnings }),
      )
    : [];
  const includedObligations = obligationBreakdown.filter(
    (obligation) => obligation.included,
  );
  const includedObligationsCents = includedObligations.reduce(
    (total, obligation) => total + toCents(obligation.amount),
    0,
  );
  const hasRequiredInputs =
    currentCash !== null && essentialBuffer !== null && nextPayday !== null;
  const hasIncompleteWarning = warnings.length > 0;
  const hasIncludedEstimate = includedObligations.some(
    (obligation) => obligation.certainty === "estimated",
  );
  const confidence = hasIncompleteWarning
    ? CONFIDENCE.INCOMPLETE
    : hasIncludedEstimate
      ? CONFIDENCE.ESTIMATED
      : CONFIDENCE.HIGH;
  const safeToSpendCents = hasRequiredInputs
    ? toCents(currentCash) -
      includedObligationsCents -
      toCents(essentialBuffer)
    : null;

  return {
    safeToSpend:
      safeToSpendCents === null ? null : fromCents(safeToSpendCents),
    currency: "CAD",
    confidence,
    horizon: {
      start: asOf,
      end: nextPayday,
    },
    breakdown: {
      currentCash,
      essentialBuffer,
      obligations: obligationBreakdown,
      includedObligationsTotal: fromCents(includedObligationsCents),
    },
    warnings,
  };
};

export const getSafeToSpendForUser = async (
  userId,
  { asOf = toUtcPlanningDate(new Date()) } = {},
) => {
  const planning = await getSavedPlanning(userId);
  return calculateSafeToSpend(planning, { asOf });
};
