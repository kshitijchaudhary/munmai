import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  NextCyclePreviewValidationError,
  PLANNING_AMOUNT_TYPES,
  PLANNING_CADENCES,
  PLANNING_CERTAINTIES,
  addPaymentDraftToPlan,
  validatePlanningObligation,
  buildNextCyclePreviewViewModel,
  buildObligationSummary,
  buildPlanningPayload,
  buildSafeToSpendViewModel,
  createEmptyObligation,
  createPlanningFormFromPreview,
  createPlanningForm,
  createSubmissionGuard,
  getCompactPaymentStatus,
  getSaveOutcomeMessage,
  getPlanningChangeState,
  formatPlanDetailsDate,
  isObligationEditorOpen,
  isPlanningFormDirty,
  loadPlanningExperience,
  orderPlanningObligations,
  removeObligation,
  requestNextCyclePreview,
  savePlanningExperience,
  scheduleTransientClear,
  updateObligationRecurrence,
  validateNextCyclePayday,
  validatePlanningForm,
} from "../src/utils/planningPage.js";

const TODAY = "2026-08-17";
const NEXT_PAYDAY = "2026-08-28";
const obligationId = "507f1f77bcf86cd799439099";

const savedPlanning = {
  planning: {
    currentCash: 500,
    nextPayday: NEXT_PAYDAY,
    essentialBuffer: 25,
    currency: "CAD",
    obligations: [
      {
        _id: obligationId,
        name: "Phone bill",
        amount: 70,
        dueDate: "2026-08-20",
        certainty: "confirmed",
        category: "bill",
        note: "Monthly",
      },
    ],
  },
};

const safeToSpend = {
  safeToSpend: 405,
  currency: "CAD",
  confidence: "high",
  horizon: { start: TODAY, end: NEXT_PAYDAY },
  breakdown: {
    currentCash: 500,
    essentialBuffer: 25,
    includedObligationsTotal: 70,
    obligations: [
      {
        id: obligationId,
        name: "Phone bill",
        amount: 70,
        dueDate: "2026-08-20",
        certainty: "confirmed",
        category: "bill",
        included: true,
        exclusionReason: null,
      },
    ],
  },
  warnings: [],
};

const nextCyclePreview = {
  planning: {
    currentCash: null,
    currency: "CAD",
    essentialBuffer: 25,
    nextPayday: "2026-09-11",
    obligations: [
      {
        name: "Car payment",
        amount: 233,
        dueDate: "2026-09-25",
        certainty: "confirmed",
        category: "bill",
        note: "Loan",
        recurring: true,
        amountType: "fixed",
        cadence: "monthly",
      },
      {
        name: "Scotia",
        amount: null,
        dueDate: "2026-09-21",
        certainty: "unknown",
        category: "credit_card",
        note: "Statement",
        recurring: true,
        amountType: "variable",
        cadence: "monthly",
      },
    ],
  },
  warnings: [
    {
      code: "ROLLED_DATE_STILL_STALE",
      obligationName: "Car payment",
      message: "Review the next Car payment date before saving.",
    },
  ],
};

test("loads saved Planning fields and presents the backend result", async () => {
  const loaded = await loadPlanningExperience({
    getPlanning: async () => savedPlanning,
    getSafeToSpend: async () => safeToSpend,
  });
  const view = buildSafeToSpendViewModel(loaded.safeToSpend);

  assert.equal(loaded.form.currentCash, "500");
  assert.equal(loaded.form.nextPayday, NEXT_PAYDAY);
  assert.equal(loaded.form.essentialBuffer, "25");
  assert.equal(loaded.form.obligations[0].name, "Phone bill");
  assert.equal(loaded.form.obligations[0].recurring, false);
  assert.equal(loaded.form.obligations[0].amountType, "");
  assert.equal(loaded.form.obligations[0].cadence, "");
  assert.equal(view.amountLabel, "$405.00");
  assert.equal(
    view.decisionLabel,
    "$405.00 extra until Aug 28",
  );
  assert.equal(view.confidenceLabel, "Based on your saved money, payments, and everyday spending allowance.");
  assert.equal(view.horizonLabel, "Next payday: Aug 28");
});

test("new obligations default to one-off without recurrence metadata", () => {
  const obligation = createEmptyObligation();

  assert.equal(obligation.recurring, false);
  assert.equal(obligation.amountType, "");
  assert.equal(obligation.cadence, "");
});

test("recurrence choices expose only the supported backend mappings", () => {
  assert.deepEqual(PLANNING_AMOUNT_TYPES, [
    { value: "fixed", label: "Same amount" },
    { value: "variable", label: "Amount changes" },
  ]);
  assert.deepEqual(PLANNING_CADENCES, [
    { value: "weekly", label: "Weekly" },
    { value: "biweekly", label: "Every 2 weeks" },
    { value: "monthly", label: "Monthly" },
  ]);
});

test("switching recurrence on requires choices and switching it off clears them", () => {
  const oneOff = createEmptyObligation();
  const recurring = updateObligationRecurrence(oneOff, true);

  assert.equal(recurring.recurring, true);
  assert.equal(recurring.amountType, "");
  assert.equal(recurring.cadence, "");

  const cleared = updateObligationRecurrence(
    { ...recurring, amountType: "fixed", cadence: "monthly" },
    false,
  );
  assert.equal(cleared.recurring, false);
  assert.equal(cleared.amountType, "");
  assert.equal(cleared.cadence, "");
});

test("next-cycle payday validation is strict and requires a later cycle", () => {
  const options = { currentPayday: NEXT_PAYDAY, today: TODAY };

  assert.equal(validateNextCyclePayday("2026-09-11", options), "");
  assert.match(validateNextCyclePayday("", options), /Choose/);
  assert.match(validateNextCyclePayday("2026-9-11", options), /valid/);
  assert.match(validateNextCyclePayday("2026-02-30", options), /valid/);
  assert.match(validateNextCyclePayday("2026-08-16", options), /today/);
  assert.match(validateNextCyclePayday(NEXT_PAYDAY, options), /after/);
});

test("requesting a preview calls only the preview API and never persists", async () => {
  const calls = [];
  const preview = await requestNextCyclePreview(
    "2026-09-11",
    {
      prepareNextPlanningCycle: async (nextPayday) => {
        calls.push(["preview", nextPayday]);
        return nextCyclePreview;
      },
      updatePlanning: async () => calls.push(["update"]),
    },
    { currentPayday: NEXT_PAYDAY, today: TODAY },
  );

  assert.equal(preview, nextCyclePreview);
  assert.deepEqual(calls, [["preview", "2026-09-11"]]);
});

test("invalid next-cycle payday is rejected before an API request", async () => {
  let calls = 0;

  await assert.rejects(
    requestNextCyclePreview(
      NEXT_PAYDAY,
      { prepareNextPlanningCycle: async () => (calls += 1) },
      { currentPayday: NEXT_PAYDAY, today: TODAY },
    ),
    NextCyclePreviewValidationError,
  );
  assert.equal(calls, 0);
});

test("preview view shows fixed, variable, buffer, cash reset, and warnings", () => {
  const view = buildNextCyclePreviewViewModel(nextCyclePreview);

  assert.match(view.nextPaydayLabel, /Sep 11/);
  assert.equal(view.essentialBufferLabel, "$25.00");
  assert.match(view.currentCashLabel, /Not carried forward/);
  assert.equal(view.obligations[0].name, "Car payment");
  assert.equal(view.obligations[0].amountLabel, "$233.00");
  assert.equal(view.obligations[0].recurrenceLabel, "Monthly · Same amount");
  assert.equal(view.obligations[1].name, "Scotia");
  assert.equal(view.obligations[1].amountLabel, "New amount needed");
  assert.equal(view.obligations[1].newAmountNeeded, true);
  assert.deepEqual(view.warnings, nextCyclePreview.warnings);
});

test("preview defensively omits one-off payments from review", () => {
  const previewWithOneOff = structuredClone(nextCyclePreview);
  previewWithOneOff.planning.obligations.push({
    name: "Friend repayment",
    recurring: false,
  });
  const view = buildNextCyclePreviewViewModel(previewWithOneOff);

  assert.equal(
    view.obligations.some((obligation) => obligation.name === "Friend repayment"),
    false,
  );
});

test("using a preview creates an unsaved form with blank cash and fresh IDs", () => {
  const previewWithUnexpectedId = structuredClone(nextCyclePreview);
  previewWithUnexpectedId.planning.obligations[0]._id = obligationId;
  const form = createPlanningFormFromPreview(previewWithUnexpectedId);

  assert.equal(form.currentCash, "");
  assert.equal(form.nextPayday, "2026-09-11");
  assert.equal(form.essentialBuffer, "25");
  assert.equal(form.obligations[0]._id, undefined);
  assert.equal(form.obligations[0].amount, "233");
  assert.equal(form.obligations[0].certainty, "confirmed");
  assert.equal(form.obligations[1].amount, "");
  assert.equal(form.obligations[1].certainty, "unknown");
  assert.notEqual(form.obligations[0].clientKey, form.obligations[1].clientKey);
});

test("preview creation does not mutate or replace the current local form", () => {
  const current = createPlanningForm(savedPlanning);
  current.currentCash = "777";
  const before = structuredClone(current);

  buildNextCyclePreviewViewModel(nextCyclePreview);

  assert.deepEqual(current, before);
  assert.equal(current.currentCash, "777");
});

test("dirty-state comparison protects unsaved current form changes", () => {
  const saved = createPlanningForm(savedPlanning);
  const unchanged = structuredClone(saved);
  const edited = structuredClone(saved);
  edited.currentCash = "875";

  assert.equal(isPlanningFormDirty(unchanged, saved), false);
  assert.equal(isPlanningFormDirty(edited, saved), true);
  assert.equal(saved.currentCash, "500");
});

test("loaded saved obligations are collapsed until one is selected for editing", () => {
  const form = createPlanningForm(savedPlanning);
  form.obligations.push(
    createEmptyObligation({
      _id: "507f1f77bcf86cd799439098",
      clientKey: "saved-507f1f77bcf86cd799439098",
      name: "Amex",
      amount: "800",
      dueDate: "2026-09-10",
    }),
  );

  assert.equal(isObligationEditorOpen(form.obligations[0], null), false);
  assert.equal(isObligationEditorOpen(form.obligations[1], null), false);

  const editingKey = form.obligations[0].clientKey;
  assert.equal(isObligationEditorOpen(form.obligations[0], editingKey), true);
  assert.equal(isObligationEditorOpen(form.obligations[1], editingKey), false);
});

test("new payment stays outside the plan until validated and appends only once", () => {
  const form = createPlanningForm(savedPlanning);
  const original = structuredClone(form);
  const draft = createEmptyObligation();
  const rejected = addPaymentDraftToPlan(form, draft);
  assert.equal(rejected.added, false);
  assert.equal(rejected.form, form);
  assert.ok(rejected.errors.name);
  assert.deepEqual(form, original);
  Object.assign(draft, { name: 'Car payment', amount: '80', dueDate: '2026-08-20' });
  const added = addPaymentDraftToPlan(form, draft);
  assert.equal(added.added, true);
  assert.equal(added.form.obligations.length, 2);
  assert.equal(added.form.obligations[1].clientKey, draft.clientKey);
  assert.notEqual(added.form.obligations[1], draft);
  assert.equal(addPaymentDraftToPlan(added.form, draft).form, added.form);
  assert.deepEqual(form, original);
});

test("incomplete defaults never present zero as confidently safe", () => {
  const view = buildSafeToSpendViewModel({
    safeToSpend: null,
    currency: "CAD",
    confidence: "incomplete",
    horizon: { start: TODAY, end: null },
    breakdown: {
      currentCash: null,
      essentialBuffer: null,
      includedObligationsTotal: 0,
      obligations: [],
    },
    warnings: [
      { code: "MISSING_NEXT_PAYDAY", message: "Next payday is missing." },
    ],
  });

  assert.equal(view.amountLabel, "Not available yet");
  assert.equal(
    view.confidenceLabel,
    "Some upcoming costs are still unknown.",
  );
  assert.equal(
    view.decisionLabel,
    "Estimate incomplete",
  );
  assert.equal(view.incomplete, true);
  assert.notEqual(view.amountLabel, "$0.00");
});

test("saving a valid plan PUTs the full payload and refreshes both endpoints", async () => {
  const form = createPlanningForm(savedPlanning);
  form.currentCash = "1000.10";
  form.nextPayday = "2026-08-30";
  form.essentialBuffer = "200.25";
  const calls = [];
  let submittedPayload;
  const refreshedSafeToSpend = { ...safeToSpend, safeToSpend: 729.85 };

  const saved = await savePlanningExperience(
    form,
    {
      updatePlanning: async (payload) => {
        calls.push("update");
        submittedPayload = payload;
      },
      getPlanning: async () => {
        calls.push("planning");
        return savedPlanning;
      },
      getSafeToSpend: async () => {
        calls.push("safe-to-spend");
        return refreshedSafeToSpend;
      },
    },
    { today: TODAY },
  );

  assert.deepEqual(calls, ["update", "planning", "safe-to-spend"]);
  assert.equal(submittedPayload.currentCash, 1000.1);
  assert.equal(submittedPayload.nextPayday, "2026-08-30");
  assert.equal(submittedPayload.essentialBuffer, 200.25);
  assert.equal(saved.safeToSpend.safeToSpend, 729.85);
});

test("full save and refresh produces transient Plan saved feedback", async () => {
  const success = getSaveOutcomeMessage({
    planningError: null,
    safeToSpendError: null,
  });
  let cleared = false;

  await new Promise((resolve) => {
    scheduleTransientClear(() => {
      cleared = true;
      resolve();
    }, 5);
  });

  assert.deepEqual(success, { type: "success", text: "Plan saved" });
  assert.equal(cleared, true);
});

test("refresh failure produces persistent error feedback instead of Plan saved", () => {
  const outcome = getSaveOutcomeMessage({
    planningError: null,
    safeToSpendError: new Error("Calculator unavailable"),
  });

  assert.equal(outcome.type, "error");
  assert.match(outcome.text, /saved.*could not be fully refreshed/i);
  assert.notEqual(outcome.text, "Plan saved");
});

test("confirmed obligation payload includes every required field", () => {
  const form = createPlanningForm(savedPlanning);
  form.obligations = [
    createEmptyObligation({
      name: "Car payment",
      amount: "230.00",
      dueDate: "2026-08-22",
      certainty: "confirmed",
      category: "personal_debt",
      note: "August payment",
    }),
  ];
  const payload = buildPlanningPayload(form, { today: TODAY });

  assert.deepEqual(payload.obligations[0], {
    name: "Car payment",
    amount: 230,
    dueDate: "2026-08-22",
    certainty: "confirmed",
    category: "personal_debt",
    note: "August payment",
    recurring: false,
    amountType: null,
    cadence: null,
  });
});

test("recurring fixed and variable payments preserve explicit payload metadata", () => {
  const cases = [
    { amountType: "fixed", cadence: "monthly" },
    { amountType: "variable", cadence: "monthly" },
    { amountType: "fixed", cadence: "weekly" },
    { amountType: "variable", cadence: "biweekly" },
  ];

  for (const recurrence of cases) {
    const form = createPlanningForm(savedPlanning);
    form.obligations = [
      createEmptyObligation({
        name: "Recurring payment",
        amount: "125",
        dueDate: "2026-08-22",
        recurring: true,
        ...recurrence,
      }),
    ];
    const payload = buildPlanningPayload(form, { today: TODAY });

    assert.equal(payload.obligations[0].recurring, true);
    assert.equal(payload.obligations[0].amountType, recurrence.amountType);
    assert.equal(payload.obligations[0].cadence, recurrence.cadence);
  }
});

test("recurring payments require explicit amount type and cadence", () => {
  const form = createPlanningForm(savedPlanning);
  form.obligations = [
    createEmptyObligation({
      name: "Recurring payment",
      amount: "125",
      dueDate: "2026-08-22",
      recurring: true,
    }),
  ];
  const missingBoth = validatePlanningForm(form, { today: TODAY });

  assert.equal(missingBoth.valid, false);
  assert.match(missingBoth.errors.obligations[0].amountType, /Choose/);
  assert.match(missingBoth.errors.obligations[0].cadence, /Choose/);

  form.obligations[0].amountType = "fixed";
  const missingCadence = validatePlanningForm(form, { today: TODAY });
  assert.equal(missingCadence.errors.obligations[0].amountType, "");
  assert.match(missingCadence.errors.obligations[0].cadence, /Choose/);
});

test("one-off payloads clear invalid stale recurrence metadata", () => {
  const form = createPlanningForm(savedPlanning);
  form.obligations[0] = {
    ...form.obligations[0],
    recurring: false,
    amountType: "invalid-stale-value",
    cadence: "yearly",
  };
  const payload = buildPlanningPayload(form, { today: TODAY });

  assert.equal(payload.obligations[0].recurring, false);
  assert.equal(payload.obligations[0].amountType, null);
  assert.equal(payload.obligations[0].cadence, null);
});

test("estimated obligation requires amount and date and uses plain-language result wording", () => {
  const form = createPlanningForm(savedPlanning);
  form.obligations = [
    createEmptyObligation({ certainty: "estimated", name: "Hydro" }),
  ];
  const validation = validatePlanningForm(form, { today: TODAY });

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.obligations[0].amount);
  assert.ok(validation.errors.obligations[0].dueDate);
  assert.equal(
    buildSafeToSpendViewModel({ ...safeToSpend, confidence: "estimated" })
      .confidenceLabel,
    "Includes estimated amounts",
  );
});

test("certainty choices map plain language to the existing backend values", () => {
  assert.deepEqual(PLANNING_CERTAINTIES, [
    { value: "confirmed", label: "Exact amount" },
    { value: "estimated", label: "Estimate" },
    { value: "unknown", label: "I don't know the amount yet" },
  ]);
});

test("unknown obligation can omit amount and date without changing certainty", () => {
  const form = createPlanningForm(savedPlanning);
  form.obligations = [
    createEmptyObligation({
      name: "Possible Amex statement",
      certainty: "unknown",
      category: "credit_card",
      amount: "",
      dueDate: "",
    }),
  ];
  const payload = buildPlanningPayload(form, { today: TODAY });

  assert.equal(payload.obligations[0].certainty, "unknown");
  assert.equal(payload.obligations[0].amount, null);
  assert.equal(payload.obligations[0].dueDate, null);
});

test("editing a saved obligation preserves its backend ID", () => {
  const form = createPlanningForm(savedPlanning);
  form.obligations[0].name = "Updated phone bill";
  const payload = buildPlanningPayload(form, { today: TODAY });

  assert.equal(payload.obligations[0]._id, obligationId);
  assert.equal(payload.obligations[0].name, "Updated phone bill");
});

test("removed obligation is absent from the replacement PUT payload", () => {
  const form = createPlanningForm(savedPlanning);
  form.obligations.push(
    createEmptyObligation({
      name: "Friend repayment",
      amount: "50",
      dueDate: "2026-08-21",
      certainty: "confirmed",
      category: "personal_debt",
    }),
  );
  const removed = removeObligation(form, form.obligations[0].clientKey);
  const payload = buildPlanningPayload(removed, { today: TODAY });

  assert.equal(payload.obligations.length, 1);
  assert.equal(payload.obligations[0].name, "Friend repayment");
  assert.equal(
    payload.obligations.some((item) => item._id === obligationId),
    false,
  );
});

test("negative Safe-to-Spend is formatted without clamping", () => {
  const view = buildSafeToSpendViewModel({
    ...safeToSpend,
    safeToSpend: -150,
  });

  assert.equal(view.amountLabel, "-$150.00");
  assert.equal(view.decisionLabel, "$150.00 short until Aug 28");
});

test("zero Safe-to-Spend explains that no uncommitted money remains", () => {
  const view = buildSafeToSpendViewModel({
    ...safeToSpend,
    safeToSpend: 0,
  });

  assert.equal(
    view.decisionLabel,
    "$0.00 extra until Aug 28",
  );
  assert.equal(view.amountLabel, "$0.00");
});

test("structured backend warning remains visible in the view model", () => {
  const warning = {
    code: "UNKNOWN_OBLIGATION_AMOUNT",
    obligationId,
    message: "Amex statement amount is unknown and is not included.",
  };
  const view = buildSafeToSpendViewModel({
    ...safeToSpend,
    confidence: "incomplete",
    warnings: [warning],
  });

  assert.deepEqual(view.warnings, [warning]);
});

test("after-payday obligation exposes its exclusion reason", () => {
  const view = buildSafeToSpendViewModel({
    ...safeToSpend,
    breakdown: {
      ...safeToSpend.breakdown,
      obligations: [
        {
          ...safeToSpend.breakdown.obligations[0],
          included: false,
          exclusionReason: "AFTER_NEXT_PAYDAY",
        },
      ],
    },
  });

  assert.equal(view.breakdown.obligations[0].status.label, "After next payday");
});

test("backend inclusion data separates current payments from later payments", () => {
  const laterId = "507f1f77bcf86cd799439098";
  const later = {
    id: laterId,
    name: "Amex",
    amount: 800,
    dueDate: "2026-09-10",
    certainty: "confirmed",
    category: "credit_card",
    included: false,
    exclusionReason: "AFTER_NEXT_PAYDAY",
  };
  const view = buildSafeToSpendViewModel({
    ...safeToSpend,
    breakdown: {
      ...safeToSpend.breakdown,
      obligations: [...safeToSpend.breakdown.obligations, later],
    },
  });

  assert.deepEqual(
    view.breakdown.includedObligations.map((item) => item.id),
    [obligationId],
  );
  assert.deepEqual(
    view.breakdown.laterObligations.map((item) => item.id),
    [laterId],
  );
  assert.equal(
    view.breakdown.includedObligations.some((item) => item.id === laterId),
    false,
  );
});

test("compact obligation summaries use backend overdue and after-payday states", () => {
  const form = createPlanningForm(savedPlanning);
  form.obligations[0].amount = "75";
  form.obligations[0].dueDate = "2026-08-21";
  const overdueResult = {
    ...safeToSpend,
    breakdown: {
      ...safeToSpend.breakdown,
      obligations: [
        {
          ...safeToSpend.breakdown.obligations[0],
          dueDate: "2026-08-16",
          included: true,
        },
      ],
    },
  };
  const overdue = buildObligationSummary(form.obligations[0], overdueResult);
  const beforePayday = buildObligationSummary(form.obligations[0], safeToSpend);
  const afterPayday = buildObligationSummary(form.obligations[0], {
    ...safeToSpend,
    breakdown: {
      ...safeToSpend.breakdown,
      obligations: [
        {
          ...safeToSpend.breakdown.obligations[0],
          included: false,
          exclusionReason: "AFTER_NEXT_PAYDAY",
        },
      ],
    },
  });

  assert.equal(overdue.status.label, "Overdue · Included");
  assert.equal(afterPayday.status.label, "After next payday");
  assert.equal(
    getCompactPaymentStatus(overdue.status),
    "Overdue · before payday",
  );
  assert.equal(
    getCompactPaymentStatus(beforePayday.status),
    "Before payday",
  );
  assert.equal(
    getCompactPaymentStatus(afterPayday.status),
    "After next payday",
  );
  assert.equal(overdue.amountLabel, "$75.00");
  assert.match(overdue.dueDateLabel, /Aug 21/);
  assert.equal(overdue.certaintyLabel, "Exact amount");
});

test("compact cards show recurring metadata only for recurring payments", () => {
  const form = createPlanningForm(savedPlanning);
  const fixed = buildObligationSummary(
    {
      ...form.obligations[0],
      recurring: true,
      amountType: "fixed",
      cadence: "monthly",
    },
    safeToSpend,
  );
  const variable = buildObligationSummary(
    {
      ...form.obligations[0],
      recurring: true,
      amountType: "variable",
      cadence: "monthly",
    },
    safeToSpend,
  );
  const oneOff = buildObligationSummary(form.obligations[0], safeToSpend);

  assert.equal(fixed.recurrenceLabel, "Monthly · Same amount");
  assert.equal(variable.recurrenceLabel, "Monthly · Amount changes");
  assert.equal(oneOff.recurrenceLabel, null);
});

test("recurrence metadata does not alter a backend Safe-to-Spend display", () => {
  const before = buildSafeToSpendViewModel(safeToSpend);
  const form = createPlanningForm(savedPlanning);
  form.obligations[0] = {
    ...form.obligations[0],
    recurring: true,
    amountType: "fixed",
    cadence: "monthly",
  };

  assert.deepEqual(buildSafeToSpendViewModel(safeToSpend), before);
  assert.equal(
    buildObligationSummary(form.obligations[0], safeToSpend).recurrenceLabel,
    "Monthly · Same amount",
  );
});

test("included obligation before horizon start is identified as overdue", () => {
  const view = buildSafeToSpendViewModel({
    ...safeToSpend,
    breakdown: {
      ...safeToSpend.breakdown,
      obligations: [
        {
          ...safeToSpend.breakdown.obligations[0],
          dueDate: "2026-08-16",
          included: true,
        },
      ],
    },
  });

  assert.equal(view.breakdown.obligations[0].status.label, "Overdue · Included");
});

test("save failure retains the caller's complete form state", async () => {
  const form = createPlanningForm(savedPlanning);
  form.currentCash = "875.50";
  const before = structuredClone(form);

  await assert.rejects(
    savePlanningExperience(
      form,
      {
        updatePlanning: async () => {
          const error = new Error("Backend validation failed");
          error.response = { status: 400, data: { message: "Invalid plan" } };
          throw error;
        },
        getPlanning: async () => savedPlanning,
        getSafeToSpend: async () => safeToSpend,
      },
      { today: TODAY },
    ),
    /Backend validation failed/,
  );

  assert.deepEqual(form, before);
});

test("submission guard prevents duplicate saves while a request is active", () => {
  const guard = createSubmissionGuard();

  assert.equal(guard.acquire(), true);
  assert.equal(guard.acquire(), false);
  guard.release();
  assert.equal(guard.acquire(), true);
});

test("Planning route and navigation remain protected and discoverable", () => {
  const appSource = readFileSync(
    new URL("../src/App.jsx", import.meta.url),
    "utf8",
  );
  const sidebarSource = readFileSync(
    new URL("../src/components/Sidebar.jsx", import.meta.url),
    "utf8",
  );

  assert.match(appSource, /path="\/planning"/);
  assert.match(appSource, /<ProtectedRoute>[\s\S]*?<Planning \/>[\s\S]*?<\/ProtectedRoute>/);
  assert.match(sidebarSource, /label: "Plan", to: "\/planning"/);
});

test("next-cycle UI keeps preview, acceptance, and persistence as explicit steps", () => {
  const apiSource = readFileSync(
    new URL("../src/api/planning.js", import.meta.url),
    "utf8",
  );
  const pageSource = readFileSync(
    new URL("../src/pages/Planning.jsx", import.meta.url),
    "utf8",
  );
  const previewSource = readFileSync(
    new URL(
      "../src/components/planning/NextCyclePreview.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const resultSource = readFileSync(
    new URL("../src/components/planning/SafeToSpendCard.jsx", import.meta.url),
    "utf8",
  );

  assert.match(apiSource, /post\("\/planning\/prepare-next-cycle"/);
  assert.match(pageSource, /Prepare next payday plan/);
  assert.match(pageSource, /requestNextCyclePreview/);
  assert.match(pageSource, /createPlanningFormFromPreview/);
  assert.match(pageSource, /isPlanningFormDirty/);
  assert.match(pageSource, /Current saved plan/);
  assert.match(pageSource, /savePlanningExperience\(form, planningApi\)/);
  assert.match(previewSource, /<label[\s\S]*?New next payday/);
  assert.match(previewSource, /type="date"/);
  assert.match(previewSource, /type="button"[\s\S]*?Use this plan/);
  assert.match(previewSource, /Replace unsaved changes/);
  assert.match(previewSource, /Cancel preview/);
  assert.match(previewSource, /obligation\.amountLabel/);
  assert.match(resultSource, /contextLabel/);
});

test("decision UX keeps compact editing while simplifying labels and secondary fields", () => {
  const pageSource = readFileSync(
    new URL("../src/pages/Planning.jsx", import.meta.url),
    "utf8",
  );
  const editorSource = readFileSync(
    new URL("../src/components/planning/ObligationEditor.jsx", import.meta.url),
    "utf8",
  );
  const resultSource = readFileSync(
    new URL("../src/components/planning/SafeToSpendCard.jsx", import.meta.url),
    "utf8",
  );

  assert.match(pageSource, /editingObligationKey/);
  assert.match(pageSource, /current\?\.type === "success" \? null : current/);
  assert.match(editorSource, />\s*Edit\s*</);
  assert.match(editorSource, />\s*Done editing\s*</);
  assert.match(editorSource, /flex-wrap/);
  assert.match(editorSource, /What is it\?/);
  assert.match(editorSource, /How much\?/);
  assert.match(editorSource, /When is it due\?/);
  assert.match(editorSource, /How certain is the amount\?/);
  assert.match(editorSource, /<details[\s\S]*?>[\s\S]*?More options/);
  assert.match(editorSource, /Does this payment repeat\?/);
  assert.match(editorSource, /Does the amount usually stay the same\?/);
  assert.match(editorSource, /How often\?/);
  assert.match(editorSource, /obligation\.recurring &&/);
  assert.match(editorSource, /Category/);
  assert.match(editorSource, /Note \(optional\)/);
  assert.match(pageSource, /How much money do you have now\?/);
  assert.match(pageSource, /When is your next payday\?/);
  assert.match(pageSource, /Set aside for everyday spending/);
  assert.match(pageSource, /Payments/);
  assert.match(resultSource, /Money you have now/);
  assert.match(resultSource, /Needs paying/);
  assert.match(resultSource, /Set aside for everyday spending/);
  assert.match(resultSource, /See breakdown/);
  assert.match(resultSource, /payments due on payday are included/);
  assert.match(pageSource, /Later payments/);
  assert.match(resultSource, /<details/);
  assert.doesNotMatch(resultSource, /High confidence/);
});

test("shortfall explains cash, included payments and the everyday spending allowance", () => {
  const view = buildSafeToSpendViewModel({ ...safeToSpend, safeToSpend: -433,
    breakdown: { ...safeToSpend.breakdown, currentCash: 100, includedObligationsTotal: 233, essentialBuffer: 300 } });
  assert.equal(view.amountLabel, "-$433.00");
  assert.equal(view.decisionLabel, "$433.00 short until Aug 28");
  assert.equal(view.breakdown.includedObligationsTotal, 233);
  assert.equal(view.breakdown.essentialBuffer, 300);
});

test("editable payments sort by payday group and date without changing payload order or identity", () => {
  const form = createPlanningForm(savedPlanning);
  form.obligations = [
    createEmptyObligation({ name: 'Later last', dueDate: '2026-09-10' }),
    createEmptyObligation({ name: 'Payday', dueDate: NEXT_PAYDAY }),
    createEmptyObligation({ name: 'Undated', dueDate: '', certainty: 'unknown' }),
    createEmptyObligation({ name: 'Overdue', dueDate: '2026-08-01' }),
    createEmptyObligation({ name: 'Before payday', dueDate: '2026-08-20' }),
    createEmptyObligation({ name: 'Later first', dueDate: '2026-08-29' }),
    createEmptyObligation({ name: 'Unknown amount', dueDate: '2026-08-21', certainty: 'unknown' }),
    createEmptyObligation({ name: 'Same day', dueDate: '2026-08-20' }),
  ];
  const original = structuredClone(form);
  const rows = orderPlanningObligations(form);
  assert.deepEqual(rows.map(({ obligation }) => obligation.name),
    ['Overdue', 'Before payday', 'Same day', 'Unknown amount', 'Payday', 'Later first', 'Later last', 'Undated']);
  assert.deepEqual(form, original);
  rows.forEach(({ obligation, index }) => assert.equal(obligation, form.obligations[index]));
  assert.equal(isPlanningFormDirty(form, original), false);
  assert.equal(rows.find(({ obligation }) => obligation.name === 'Later first').index, 5);
  const changed = { ...form, nextPayday: '2026-08-20' };
  assert.equal(orderPlanningObligations(changed).at(-1).obligation.name, 'Undated');
});

test("missing payday and invalid dates sort deterministically without inferring a payday", () => {
  const form = { nextPayday: '', obligations: [
    { name: 'Invalid', dueDate: '2026-02-30' },
    { name: 'Later', dueDate: '2026-08-28' },
    { name: 'Earlier', dueDate: '2026-08-01' },
    { name: 'No date', dueDate: '' },
  ] };
  assert.deepEqual(orderPlanningObligations(form).map(({ obligation }) => obligation.name),
    ['Earlier', 'Later', 'Invalid', 'No date']);
});

test("draft payment summaries do not claim inclusion from the old saved result", () => {
  const form = createPlanningForm(savedPlanning);
  form.obligations[0].dueDate = '2026-09-10';
  const summary = buildObligationSummary(form.obligations[0], safeToSpend, { draft: true });
  assert.equal(getCompactPaymentStatus(summary.status), 'Unsaved changes');
});

test("partial refresh after PUT preserves draft data and reports an error for either failed read", async () => {
  for (const failedRead of ['getPlanning', 'getSafeToSpend']) {
    const form = createPlanningForm(savedPlanning);
    form.currentCash = '100';
    const before = structuredClone(form);
    let writes = 0;
    const api = {
      updatePlanning: async () => { writes++; },
      getPlanning: async () => savedPlanning,
      getSafeToSpend: async () => safeToSpend,
      [failedRead]: async () => { throw new Error('Refresh unavailable'); },
    };
    const loaded = await savePlanningExperience(form, api, { today: TODAY });
    assert.equal(writes, 1);
    assert.equal(getSaveOutcomeMessage(loaded).type, 'error');
    assert.deepEqual(form, before);
  }
});

test("incomplete positive and zero results never promise spendable money", () => {
  for (const amount of [405, 0, null]) {
    const view = buildSafeToSpendViewModel({ ...safeToSpend, confidence: 'incomplete', safeToSpend: amount });
    assert.equal(view.decisionLabel, 'Estimate incomplete');
    assert.equal(view.knownShortfallLabel, null);
    assert.equal(view.incomplete, true);
  }
});

test("incomplete negative result keeps the backend shortfall as a known amount", () => {
  const view = buildSafeToSpendViewModel({ ...safeToSpend, confidence: 'incomplete', safeToSpend: -433 });
  assert.equal(view.decisionLabel, 'Estimate incomplete');
  assert.equal(view.knownShortfallLabel, '$433.00 short until Aug 28');
  assert.equal(view.amountLabel, '-$433.00');
});

test("a successful write supplies a saved baseline even when refreshed reads fail", async () => {
  const form = createPlanningForm(savedPlanning);
  form.currentCash = '123';
  const loaded = await savePlanningExperience(form, {
    updatePlanning: async (payload) => ({ planning: payload }),
    getPlanning: async () => { throw new Error('offline'); },
    getSafeToSpend: async () => { throw new Error('offline'); },
  }, { today: TODAY });
  assert.equal(loaded.savedForm.currentCash, '123');
  assert.equal(loaded.savedForm.obligations[0]._id, obligationId);
  assert.equal(getSaveOutcomeMessage(loaded).type, 'error');
  assert.equal(form.currentCash, '123');
});


test("new payment validation shares confirmed, estimated, unknown and strict date rules", () => {
  const form = createPlanningForm(savedPlanning);
  for (const certainty of ['confirmed', 'estimated']) {
    const draft = createEmptyObligation({ name: 'Payment', certainty });
    assert.ok(validatePlanningObligation(draft).amount);
    assert.ok(validatePlanningObligation(draft).dueDate);
    Object.assign(draft, { amount: '20.25', dueDate: '2026-08-01' });
    assert.equal(addPaymentDraftToPlan(form, draft).added, true);
    draft.dueDate = '2026-02-30';
    assert.ok(validatePlanningObligation(draft).dueDate);
    draft.dueDate = NEXT_PAYDAY;
    assert.equal(addPaymentDraftToPlan(form, draft).added, true);
    draft.amount = '20.001';
    assert.ok(validatePlanningObligation(draft).amount);
  }
  const unknown = createEmptyObligation({ name: 'Utility', certainty: 'unknown' });
  assert.equal(addPaymentDraftToPlan(form, unknown).added, true);
  unknown.name = ' ';
  assert.equal(addPaymentDraftToPlan(form, unknown).added, false);
});

test("new recurring payment requires the existing recurrence metadata", () => {
  const draft = createEmptyObligation({ name: 'Phone', amount: '70', dueDate: NEXT_PAYDAY, recurring: true });
  assert.ok(validatePlanningObligation(draft).amountType);
  assert.ok(validatePlanningObligation(draft).cadence);
  draft.amountType = 'variable';
  draft.cadence = 'monthly';
  assert.equal(Object.values(validatePlanningObligation(draft)).some(Boolean), false);
});


test("shared save label tracks details and payment changes independently", () => {
  const saved = createPlanningForm(savedPlanning);
  const draft = structuredClone(saved);
  assert.deepEqual(getPlanningChangeState(draft, saved), { detailsDirty: false, paymentsDirty: false });
  draft.currentCash = '150';
  assert.deepEqual(getPlanningChangeState(draft, saved), { detailsDirty: true, paymentsDirty: false });
  draft.obligations[0].amount = '99';
  assert.deepEqual(getPlanningChangeState(draft, saved), { detailsDirty: true, paymentsDirty: true });
  draft.currentCash = saved.currentCash;
  assert.deepEqual(getPlanningChangeState(draft, saved), { detailsDirty: false, paymentsDirty: true });
  draft.obligations[0].amount = saved.obligations[0].amount;
  draft.obligations[0].clientKey = 'display-only-key';
  assert.deepEqual(getPlanningChangeState(draft, saved), { detailsDirty: false, paymentsDirty: false });
});


test("saved details date is clear and respects calendar boundaries", () => {
  assert.equal(formatPlanDetailsDate('2026-10-08'), '8 Oct 2026');
  assert.equal(formatPlanDetailsDate('2026-01-01'), '1 Jan 2026');
  assert.equal(formatPlanDetailsDate('2026-02-30'), 'Date unknown');
  assert.equal(formatPlanDetailsDate(null), 'Date unknown');
});
