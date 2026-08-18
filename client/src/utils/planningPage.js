export const PLANNING_CERTAINTIES = [
  { value: "confirmed", label: "Confirmed" },
  { value: "estimated", label: "Estimated" },
  { value: "unknown", label: "Unknown" },
];

export const PLANNING_CATEGORIES = [
  { value: "bill", label: "Bill" },
  { value: "credit_card", label: "Credit card" },
  { value: "personal_debt", label: "Personal debt" },
  { value: "other", label: "Other" },
];

const certaintyValues = new Set(PLANNING_CERTAINTIES.map(({ value }) => value));
const categoryValues = new Set(PLANNING_CATEGORIES.map(({ value }) => value));
const strictDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const moneyPattern = /^\d+(?:\.\d{1,2})?$/;
let localObligationSequence = 0;

export class PlanningFormValidationError extends Error {
  constructor(errors) {
    super("Please correct the highlighted planning fields.");
    this.name = "PlanningFormValidationError";
    this.errors = errors;
  }
}

export const getTodayCalendarDate = (date = new Date()) =>
  [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");

export const isStrictCalendarDate = (value) => {
  if (typeof value !== "string") return false;

  const match = value.match(strictDatePattern);
  if (!match || Number(match[1]) < 1) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const formatCad = (value, unavailable = "Not available yet") => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return unavailable;
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
};

export const formatCalendarDate = (value) => {
  if (!isStrictCalendarDate(value)) return "Date unknown";

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
};

export const createSubmissionGuard = () => {
  let active = false;

  return {
    acquire() {
      if (active) return false;
      active = true;
      return true;
    },
    release() {
      active = false;
    },
  };
};

const createClientKey = (id) =>
  id ? `saved-${id}` : `new-${Date.now()}-${++localObligationSequence}`;

export const createEmptyObligation = (overrides = {}) => ({
  _id: undefined,
  clientKey: createClientKey(),
  name: "",
  amount: "",
  dueDate: "",
  certainty: "confirmed",
  category: "bill",
  note: "",
  ...overrides,
});

const toInputMoney = (value) =>
  value === null || value === undefined ? "" : String(value);

export const createPlanningForm = (planningResponse) => {
  const planning = planningResponse?.planning || planningResponse || {};

  return {
    currentCash: toInputMoney(planning.currentCash ?? 0),
    nextPayday: isStrictCalendarDate(planning.nextPayday)
      ? planning.nextPayday
      : "",
    essentialBuffer: toInputMoney(planning.essentialBuffer ?? 0),
    obligations: Array.isArray(planning.obligations)
      ? planning.obligations.map((item) => ({
          _id: item._id,
          clientKey: createClientKey(item._id),
          name: String(item.name || ""),
          amount: toInputMoney(item.amount),
          dueDate: isStrictCalendarDate(item.dueDate) ? item.dueDate : "",
          certainty: certaintyValues.has(item.certainty)
            ? item.certainty
            : "unknown",
          category: categoryValues.has(item.category) ? item.category : "other",
          note: String(item.note || ""),
        }))
      : [],
  };
};

export const createEmptyPlanningForm = () => createPlanningForm(null);

const validateMoney = (value, { allowZero, required }) => {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return required ? "Enter an amount." : "";
  }

  if (!moneyPattern.test(normalized)) {
    return "Use a dollar amount with no more than 2 decimal places.";
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount === 0)) {
    return allowZero ? "Amount cannot be negative." : "Amount must be greater than 0.";
  }

  return "";
};

export const validatePlanningForm = (
  form,
  { today = getTodayCalendarDate() } = {},
) => {
  const errors = {
    currentCash: validateMoney(form.currentCash, {
      allowZero: true,
      required: true,
    }),
    nextPayday: "",
    essentialBuffer: validateMoney(form.essentialBuffer, {
      allowZero: true,
      required: true,
    }),
    obligations: [],
  };

  if (!form.nextPayday) {
    errors.nextPayday = "Choose your next payday.";
  } else if (!isStrictCalendarDate(form.nextPayday)) {
    errors.nextPayday = "Use a valid calendar date.";
  } else if (form.nextPayday < today) {
    errors.nextPayday = "Next payday must be today or later.";
  }

  form.obligations.forEach((item) => {
    const known = item.certainty === "confirmed" || item.certainty === "estimated";
    const obligationErrors = {
      name: item.name.trim() ? "" : "Enter an obligation name.",
      amount: validateMoney(item.amount, {
        allowZero: false,
        required: known,
      }),
      dueDate: "",
      certainty: certaintyValues.has(item.certainty)
        ? ""
        : "Choose a valid certainty.",
      category: categoryValues.has(item.category)
        ? ""
        : "Choose a valid category.",
      note:
        item.note.length <= 500 ? "" : "Note cannot exceed 500 characters.",
    };

    if (known && !item.dueDate) {
      obligationErrors.dueDate = "Choose a due date.";
    } else if (item.dueDate && !isStrictCalendarDate(item.dueDate)) {
      obligationErrors.dueDate = "Use a valid calendar date.";
    }

    errors.obligations.push(obligationErrors);
  });

  const topLevelValid = !errors.currentCash && !errors.nextPayday && !errors.essentialBuffer;
  const obligationsValid = errors.obligations.every((item) =>
    Object.values(item).every((message) => !message),
  );

  return { errors, valid: topLevelValid && obligationsValid };
};

export const buildPlanningPayload = (form, options) => {
  const validation = validatePlanningForm(form, options);

  if (!validation.valid) {
    throw new PlanningFormValidationError(validation.errors);
  }

  return {
    currentCash: Number(form.currentCash),
    nextPayday: form.nextPayday,
    essentialBuffer: Number(form.essentialBuffer),
    obligations: form.obligations.map((item) => ({
      ...(item._id ? { _id: item._id } : {}),
      name: item.name.trim(),
      amount: item.amount === "" ? null : Number(item.amount),
      dueDate: item.dueDate || null,
      certainty: item.certainty,
      category: item.category,
      note: item.note.trim(),
    })),
    currency: "CAD",
  };
};

export const removeObligation = (form, clientKey) => ({
  ...form,
  obligations: form.obligations.filter((item) => item.clientKey !== clientKey),
});

export const loadPlanningExperience = async (planningApi) => {
  const [planningResult, safeToSpendResult] = await Promise.allSettled([
    planningApi.getPlanning(),
    planningApi.getSafeToSpend(),
  ]);

  return {
    form:
      planningResult.status === "fulfilled"
        ? createPlanningForm(planningResult.value)
        : null,
    safeToSpend:
      safeToSpendResult.status === "fulfilled" ? safeToSpendResult.value : null,
    planningError:
      planningResult.status === "rejected" ? planningResult.reason : null,
    safeToSpendError:
      safeToSpendResult.status === "rejected" ? safeToSpendResult.reason : null,
  };
};

export const savePlanningExperience = async (form, planningApi, options) => {
  const payload = buildPlanningPayload(form, options);
  await planningApi.updatePlanning(payload);
  const refreshed = await loadPlanningExperience(planningApi);
  return { ...refreshed, payload };
};

const confidenceLabels = {
  high: "High confidence",
  estimated: "Includes estimates",
  incomplete: "Incomplete",
};

const statusForObligation = (item, horizonStart) => {
  if (item.included && item.dueDate && item.dueDate < horizonStart) {
    return { label: "Overdue · Included", tone: "overdue" };
  }

  if (item.included) return { label: "Included", tone: "included" };
  if (item.exclusionReason === "AFTER_NEXT_PAYDAY") {
    return { label: "After next payday", tone: "excluded" };
  }

  return { label: "Not included", tone: "incomplete" };
};

export const buildSafeToSpendViewModel = (result) => {
  const horizonStart = result?.horizon?.start || "";
  const obligations = Array.isArray(result?.breakdown?.obligations)
    ? result.breakdown.obligations.map((item) => ({
        ...item,
        amountLabel: formatCad(item.amount, "Amount unknown"),
        dueDateLabel: formatCalendarDate(item.dueDate),
        status: statusForObligation(item, horizonStart),
      }))
    : [];

  return {
    amountLabel: formatCad(result?.safeToSpend),
    confidence: result?.confidence || "incomplete",
    confidenceLabel:
      confidenceLabels[result?.confidence] || confidenceLabels.incomplete,
    horizonLabel: result?.horizon?.end
      ? `Until ${formatCalendarDate(result.horizon.end)}`
      : "Add your next payday to calculate",
    incomplete: result?.confidence === "incomplete" || result?.safeToSpend === null,
    warnings: Array.isArray(result?.warnings) ? result.warnings : [],
    breakdown: {
      currentCash: result?.breakdown?.currentCash ?? null,
      essentialBuffer: result?.breakdown?.essentialBuffer ?? null,
      includedObligationsTotal:
        result?.breakdown?.includedObligationsTotal ?? 0,
      obligations,
    },
  };
};

export const getApiErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;
