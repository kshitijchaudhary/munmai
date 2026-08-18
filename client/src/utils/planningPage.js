export const PLANNING_CERTAINTIES = [
  { value: "confirmed", label: "Exact amount" },
  { value: "estimated", label: "Estimate" },
  { value: "unknown", label: "I don't know the amount yet" },
];

export const PLANNING_CATEGORIES = [
  { value: "bill", label: "Bill" },
  { value: "credit_card", label: "Credit card" },
  { value: "personal_debt", label: "Personal debt" },
  { value: "other", label: "Other" },
];

export const PLANNING_AMOUNT_TYPES = [
  { value: "fixed", label: "Same amount" },
  { value: "variable", label: "Amount changes" },
];

export const PLANNING_CADENCES = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
];

const certaintyValues = new Set(PLANNING_CERTAINTIES.map(({ value }) => value));
const categoryValues = new Set(PLANNING_CATEGORIES.map(({ value }) => value));
const amountTypeValues = new Set(
  PLANNING_AMOUNT_TYPES.map(({ value }) => value),
);
const cadenceValues = new Set(PLANNING_CADENCES.map(({ value }) => value));
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

export const formatShortCalendarDate = (value) => {
  if (!isStrictCalendarDate(value)) return "Date unknown";

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
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
  recurring: false,
  amountType: "",
  cadence: "",
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
      ? planning.obligations.map((item) => {
          const recurring = item.recurring === true;

          return {
            _id: item._id,
            clientKey: createClientKey(item._id),
            name: String(item.name || ""),
            amount: toInputMoney(item.amount),
            dueDate: isStrictCalendarDate(item.dueDate) ? item.dueDate : "",
            certainty: certaintyValues.has(item.certainty)
              ? item.certainty
              : "unknown",
            category: categoryValues.has(item.category)
              ? item.category
              : "other",
            note: String(item.note || ""),
            recurring,
            amountType:
              recurring && amountTypeValues.has(item.amountType)
                ? item.amountType
                : "",
            cadence:
              recurring && cadenceValues.has(item.cadence) ? item.cadence : "",
          };
        })
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
      amountType:
        item.recurring === true && !amountTypeValues.has(item.amountType)
          ? "Choose whether the amount stays the same or changes."
          : "",
      cadence:
        item.recurring === true && !cadenceValues.has(item.cadence)
          ? "Choose how often this payment repeats."
          : "",
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
      recurring: item.recurring === true,
      amountType: item.recurring === true ? item.amountType : null,
      cadence: item.recurring === true ? item.cadence : null,
    })),
    currency: "CAD",
  };
};

export const removeObligation = (form, clientKey) => ({
  ...form,
  obligations: form.obligations.filter((item) => item.clientKey !== clientKey),
});

export const updateObligationRecurrence = (obligation, recurring) => ({
  ...obligation,
  recurring: recurring === true,
  amountType: "",
  cadence: "",
});

export const addObligationForEditing = (form, overrides) => {
  const obligation = createEmptyObligation(overrides);

  return {
    form: {
      ...form,
      obligations: [...form.obligations, obligation],
    },
    editingObligationKey: obligation.clientKey,
  };
};

export const isObligationEditorOpen = (obligation, editingObligationKey) =>
  obligation.clientKey === editingObligationKey;

export const findFirstInvalidObligationKey = (form, errors) => {
  const invalidIndex = errors?.obligations?.findIndex((item) =>
    Object.values(item || {}).some(Boolean),
  );

  return invalidIndex >= 0 ? form.obligations[invalidIndex]?.clientKey || null : null;
};

export const scheduleTransientClear = (callback, delay = 2500) => {
  const timer = setTimeout(callback, delay);
  return () => clearTimeout(timer);
};

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
  high: "Based on the bills you've entered.",
  estimated: "Includes estimated amounts",
  incomplete: "Some upcoming costs are still unknown.",
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

export const buildObligationSummary = (obligation, safeToSpendResult) => {
  const resultObligations = Array.isArray(
    safeToSpendResult?.breakdown?.obligations,
  )
    ? safeToSpendResult.breakdown.obligations
    : [];
  const resultItem = obligation._id
    ? resultObligations.find(
        (item) => String(item.id || item._id) === String(obligation._id),
      )
    : null;
  const localAmount = String(obligation.amount ?? "").trim();
  const amount = localAmount ? Number(localAmount) : null;
  const dueDate = obligation.dueDate;
  const certainty =
    PLANNING_CERTAINTIES.find((item) => item.value === obligation.certainty)
      ?.label || "Unknown";

  return {
    name: obligation.name.trim() || "Unnamed obligation",
    amountLabel: formatCad(amount, "Amount unknown"),
    dueDateLabel: isStrictCalendarDate(dueDate)
      ? formatCalendarDate(dueDate)
      : "Unknown date",
    certaintyLabel: certainty,
    recurrenceLabel:
      obligation.recurring === true &&
      amountTypeValues.has(obligation.amountType) &&
      cadenceValues.has(obligation.cadence)
        ? `${
            PLANNING_CADENCES.find(
              (item) => item.value === obligation.cadence,
            ).label
          } · ${
            PLANNING_AMOUNT_TYPES.find(
              (item) => item.value === obligation.amountType,
            ).label
          }`
        : null,
    status: resultItem
      ? statusForObligation(
          resultItem,
          safeToSpendResult?.horizon?.start || "",
        )
      : { label: "Not included / incomplete", tone: "incomplete" },
  };
};

export const getCompactPaymentStatus = (status) => {
  const labels = {
    overdue: "Overdue · before payday",
    included: "Before payday",
    excluded: "After next payday",
    incomplete: "Needs details",
  };

  return labels[status?.tone] || labels.incomplete;
};

export const getSaveOutcomeMessage = (loaded) =>
  loaded.planningError || loaded.safeToSpendError
    ? {
        type: "error",
        text: "Plan saved, but the latest result could not be fully refreshed.",
      }
    : { type: "success", text: "Plan saved" };

export const buildSafeToSpendViewModel = (result) => {
  const horizonStart = result?.horizon?.start || "";
  const safeToSpendAmount = result?.safeToSpend;
  const hasSafeToSpendAmount =
    safeToSpendAmount !== null &&
    safeToSpendAmount !== undefined &&
    Number.isFinite(Number(safeToSpendAmount));
  const obligations = Array.isArray(result?.breakdown?.obligations)
    ? result.breakdown.obligations.map((item) => ({
        ...item,
        amountLabel: formatCad(item.amount, "Amount unknown"),
        dueDateLabel: formatCalendarDate(item.dueDate),
        shortDueDateLabel: formatShortCalendarDate(item.dueDate),
        status: statusForObligation(item, horizonStart),
      }))
    : [];
  const includedObligations = obligations.filter((item) => item.included);
  const laterObligations = obligations.filter(
    (item) =>
      !item.included && item.exclusionReason === "AFTER_NEXT_PAYDAY",
  );

  let decisionLabel = "Complete your plan to see what is safe to spend.";

  if (hasSafeToSpendAmount && Number(safeToSpendAmount) > 0) {
    decisionLabel = `You can safely spend ${formatCad(safeToSpendAmount)} before payday`;
  } else if (hasSafeToSpendAmount && Number(safeToSpendAmount) < 0) {
    decisionLabel = `You're short ${formatCad(Math.abs(Number(safeToSpendAmount)))} before payday`;
  } else if (hasSafeToSpendAmount) {
    decisionLabel = "You have no uncommitted money before payday";
  }

  return {
    amountLabel: formatCad(safeToSpendAmount),
    decisionLabel,
    confidence: result?.confidence || "incomplete",
    confidenceLabel:
      confidenceLabels[result?.confidence] || confidenceLabels.incomplete,
    horizonLabel: result?.horizon?.end
      ? `Next payday: ${formatShortCalendarDate(result.horizon.end)}`
      : "Add your next payday to calculate",
    incomplete:
      result?.confidence === "incomplete" || !hasSafeToSpendAmount,
    warnings: Array.isArray(result?.warnings) ? result.warnings : [],
    breakdown: {
      currentCash: result?.breakdown?.currentCash ?? null,
      essentialBuffer: result?.breakdown?.essentialBuffer ?? null,
      includedObligationsTotal:
        result?.breakdown?.includedObligationsTotal ?? 0,
      obligations,
      includedObligations,
      laterObligations,
    },
  };
};

export const getApiErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;
