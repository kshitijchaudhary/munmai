import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  addObligationForEditing,
  buildObligationSummary,
  buildPlanningPayload,
  buildSafeToSpendViewModel,
  createEmptyObligation,
  createPlanningForm,
  createSubmissionGuard,
  getSaveOutcomeMessage,
  isObligationEditorOpen,
  loadPlanningExperience,
  removeObligation,
  savePlanningExperience,
  scheduleTransientClear,
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
  assert.equal(view.amountLabel, "$405.00");
  assert.equal(view.confidenceLabel, "High confidence");
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
  assert.equal(view.confidenceLabel, "Incomplete");
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
  });
});

test("estimated obligation requires amount and date and displays estimate confidence", () => {
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
    "Includes estimates",
  );
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
  assert.equal(overdue.amountLabel, "$75.00");
  assert.match(overdue.dueDateLabel, /Aug 21/);
  assert.equal(overdue.certaintyLabel, "Confirmed");
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

test("Planning polish uses compact controls, payday wording, and responsive wrapping", () => {
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
  assert.match(resultSource, /Due before payday/);
  assert.match(resultSource, /What's due/);
  assert.doesNotMatch(resultSource, />Included obligations</);
});
