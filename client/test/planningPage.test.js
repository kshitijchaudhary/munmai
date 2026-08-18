import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PLANNING_AMOUNT_TYPES,
  PLANNING_CADENCES,
  PLANNING_CERTAINTIES,
  addObligationForEditing,
  buildObligationSummary,
  buildPlanningPayload,
  buildSafeToSpendViewModel,
  createEmptyObligation,
  createPlanningForm,
  createSubmissionGuard,
  getCompactPaymentStatus,
  getSaveOutcomeMessage,
  isObligationEditorOpen,
  loadPlanningExperience,
  removeObligation,
  savePlanningExperience,
  scheduleTransientClear,
  updateObligationRecurrence,
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
    "You can safely spend $405.00 before payday",
  );
  assert.equal(view.confidenceLabel, "Based on the bills you've entered.");
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

test("adding an obligation opens the new editor without expanding saved items", () => {
  const form = createPlanningForm(savedPlanning);
  const added = addObligationForEditing(form, { name: "Car payment" });
  const newObligation = added.form.obligations.at(-1);

  assert.equal(added.form.obligations.length, 2);
  assert.equal(newObligation.name, "Car payment");
  assert.equal(
    isObligationEditorOpen(newObligation, added.editingObligationKey),
    true,
  );
  assert.equal(
    isObligationEditorOpen(
      added.form.obligations[0],
      added.editingObligationKey,
    ),
    false,
  );
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
    "Complete your plan to see what is safe to spend.",
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
  assert.equal(view.decisionLabel, "You're short $150.00 before payday");
});

test("zero Safe-to-Spend explains that no uncommitted money remains", () => {
  const view = buildSafeToSpendViewModel({
    ...safeToSpend,
    safeToSpend: 0,
  });

  assert.equal(
    view.decisionLabel,
    "You have no uncommitted money before payday",
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
  assert.match(pageSource, /Keep for everyday use/);
  assert.match(pageSource, /What payments are coming up\?/);
  assert.match(resultSource, /Money you have now/);
  assert.match(resultSource, /Needs paying/);
  assert.match(resultSource, /Keep for everyday use/);
  assert.match(resultSource, /Safe to spend/);
  assert.match(resultSource, /Needs paying before payday/);
  assert.match(resultSource, /Later — after next payday/);
  assert.match(resultSource, /<details/);
  assert.doesNotMatch(resultSource, /High confidence/);
});
