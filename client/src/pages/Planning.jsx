import { useCallback, useEffect, useRef, useState } from "react";
import * as planningApi from "../api/planning";
import ObligationEditor from "../components/planning/ObligationEditor";
import SafeToSpendCard from "../components/planning/SafeToSpendCard";
import Sidebar from "../components/Sidebar";
import {
  PlanningFormValidationError,
  addObligationForEditing,
  buildObligationSummary,
  createSubmissionGuard,
  createEmptyPlanningForm,
  findFirstInvalidObligationKey,
  getApiErrorMessage,
  getSaveOutcomeMessage,
  getTodayCalendarDate,
  isObligationEditorOpen,
  loadPlanningExperience,
  removeObligation,
  savePlanningExperience,
  scheduleTransientClear,
  validatePlanningForm,
} from "../utils/planningPage";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-950 dark:disabled:bg-slate-800";

const FieldError = ({ id, message }) =>
  message ? (
    <p id={id} role="alert" className="mt-1 text-xs font-semibold text-rose-600">
      {message}
    </p>
  ) : null;

const Planning = () => {
  const [form, setForm] = useState(createEmptyPlanningForm);
  const [formErrors, setFormErrors] = useState({ obligations: [] });
  const [safeToSpend, setSafeToSpend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [resultError, setResultError] = useState("");
  const [message, setMessage] = useState(null);
  const [editingObligationKey, setEditingObligationKey] = useState(null);
  const savingGuardRef = useRef(createSubmissionGuard());
  const successTimerRef = useRef(null);

  const cancelSuccessTimer = useCallback(() => {
    successTimerRef.current?.();
    successTimerRef.current = null;
  }, []);

  const clearTransientSuccess = useCallback(() => {
    cancelSuccessTimer();
    setMessage((current) => (current?.type === "success" ? null : current));
  }, [cancelSuccessTimer]);

  const showTransientSuccess = useCallback(
    (text) => {
      cancelSuccessTimer();
      setMessage({ type: "success", text });
      successTimerRef.current = scheduleTransientClear(() => {
        successTimerRef.current = null;
        setMessage((current) =>
          current?.type === "success" ? null : current,
        );
      });
    },
    [cancelSuccessTimer],
  );

  const applyLoadedExperience = useCallback((loaded) => {
    if (loaded.form) {
      setForm(loaded.form);
      setEditingObligationKey(null);
    }
    if (loaded.safeToSpend) setSafeToSpend(loaded.safeToSpend);

    setLoadError(
      loaded.planningError
        ? getApiErrorMessage(loaded.planningError, "Failed to load your plan.")
        : "",
    );
    setResultError(
      loaded.safeToSpendError
        ? getApiErrorMessage(
            loaded.safeToSpendError,
            "Safe to Spend could not be refreshed.",
          )
        : "",
    );
  }, []);

  const loadPage = useCallback(async () => {
    cancelSuccessTimer();
    setMessage(null);
    setLoading(true);
    setLoadError("");
    setResultError("");

    const loaded = await loadPlanningExperience(planningApi);
    applyLoadedExperience(loaded);
    setLoading(false);
  }, [applyLoadedExperience, cancelSuccessTimer]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => cancelSuccessTimer, [cancelSuccessTimer]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: "" }));
    clearTransientSuccess();
  };

  const updateObligation = (index, obligation) => {
    setForm((current) => ({
      ...current,
      obligations: current.obligations.map((item, itemIndex) =>
        itemIndex === index ? obligation : item,
      ),
    }));
    setFormErrors((current) => ({
      ...current,
      obligations: current.obligations.map((item, itemIndex) =>
        itemIndex === index ? {} : item,
      ),
    }));
    clearTransientSuccess();
  };

  const handleRemoveObligation = (clientKey) => {
    setForm((current) => removeObligation(current, clientKey));
    setFormErrors((current) => ({ ...current, obligations: [] }));
    setEditingObligationKey((current) =>
      current === clientKey ? null : current,
    );
    clearTransientSuccess();
  };

  const handleAddObligation = () => {
    const added = addObligationForEditing(form);
    setForm(added.form);
    setEditingObligationKey(added.editingObligationKey);
    setFormErrors((current) => ({ ...current, obligations: [] }));
    clearTransientSuccess();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!savingGuardRef.current.acquire()) return;

    cancelSuccessTimer();
    setMessage(null);

    const validation = validatePlanningForm(form);

    if (!validation.valid) {
      savingGuardRef.current.release();
      setFormErrors(validation.errors);
      setEditingObligationKey(
        findFirstInvalidObligationKey(form, validation.errors),
      );
      setMessage({
        type: "error",
        text: "Please correct the highlighted fields before saving.",
      });
      return;
    }

    setSaving(true);
    setMessage(null);
    setLoadError("");

    try {
      const loaded = await savePlanningExperience(form, planningApi);
      applyLoadedExperience(loaded);
      setFormErrors({ obligations: [] });

      const outcome = getSaveOutcomeMessage(loaded);

      if (outcome.type === "error") {
        setMessage(outcome);
      } else {
        showTransientSuccess(outcome.text);
      }
    } catch (error) {
      if (error instanceof PlanningFormValidationError) {
        setFormErrors(error.errors);
      }

      setMessage({
        type: "error",
        text: getApiErrorMessage(error, "Failed to save your plan."),
      });
    } finally {
      savingGuardRef.current.release();
      setSaving(false);
    }
  };

  const disabled = loading || saving;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Sidebar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10 lg:ml-72 lg:w-auto">
        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold text-indigo-600">Plan</p>
          <h1 className="text-3xl font-black text-slate-900 md:text-4xl">
            Plan your money until payday
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            See what is already spoken for and what is still safe to spend.
          </p>
        </header>

        {loadError && (
          <div role="alert" className="mb-6 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 sm:flex-row sm:items-center sm:justify-between">
            <span>{loadError}</span>
            <button type="button" onClick={loadPage} className="self-start font-black underline sm:self-auto">
              Try again
            </button>
          </div>
        )}

        {message && (
          <div
            role={message.type === "error" ? "alert" : "status"}
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-semibold ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="xl:sticky xl:top-8">
            <SafeToSpendCard
              result={safeToSpend}
              loading={loading}
              error={resultError}
            />
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 md:p-6">
              <div>
                <h2 className="text-xl font-black text-slate-900">Your payday plan</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Use only the money and commitments you want considered for this payday period.
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                <label className="block md:col-span-2" htmlFor="planning-current-cash">
                  <span className="mb-1 block text-sm font-bold text-slate-700">Money you have now</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-3 text-sm font-bold text-slate-400">$</span>
                    <input
                      id="planning-current-cash"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.currentCash}
                      onChange={(event) => updateField("currentCash", event.target.value)}
                      disabled={disabled}
                      required
                      aria-invalid={Boolean(formErrors.currentCash)}
                      aria-describedby="planning-current-cash-help planning-current-cash-error"
                      className={`${inputClass} pl-8`}
                    />
                  </div>
                  <p id="planning-current-cash-help" className="mt-1 text-xs text-slate-500">
                    Include the liquid money you want Munmai to consider until your next payday.
                  </p>
                  <FieldError id="planning-current-cash-error" message={formErrors.currentCash} />
                </label>

                <label className="block" htmlFor="planning-next-payday">
                  <span className="mb-1 block text-sm font-bold text-slate-700">Next payday</span>
                  <input
                    id="planning-next-payday"
                    type="date"
                    min={getTodayCalendarDate()}
                    value={form.nextPayday}
                    onChange={(event) => updateField("nextPayday", event.target.value)}
                    disabled={disabled}
                    required
                    aria-invalid={Boolean(formErrors.nextPayday)}
                    aria-describedby={formErrors.nextPayday ? "planning-next-payday-error" : undefined}
                    className={inputClass}
                  />
                  <FieldError id="planning-next-payday-error" message={formErrors.nextPayday} />
                </label>

                <label className="block" htmlFor="planning-essential-buffer">
                  <span className="mb-1 block text-sm font-bold text-slate-700">Essential buffer</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-3 text-sm font-bold text-slate-400">$</span>
                    <input
                      id="planning-essential-buffer"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.essentialBuffer}
                      onChange={(event) => updateField("essentialBuffer", event.target.value)}
                      disabled={disabled}
                      required
                      aria-invalid={Boolean(formErrors.essentialBuffer)}
                      aria-describedby="planning-essential-buffer-help planning-essential-buffer-error"
                      className={`${inputClass} pl-8`}
                    />
                  </div>
                  <p id="planning-essential-buffer-help" className="mt-1 text-xs text-slate-500">
                    Money protected for essentials like food, gas, or emergencies.
                  </p>
                  <FieldError id="planning-essential-buffer-error" message={formErrors.essentialBuffer} />
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 md:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Obligations</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Add the bills and commitments that may be due before payday.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddObligation}
                  disabled={disabled}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:text-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
                >
                  + Add obligation
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {form.obligations.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center dark:border-slate-700">
                    <p className="font-bold text-slate-700">No obligations added.</p>
                    <p className="mt-1 text-sm text-slate-500">Add anything already spoken for before payday.</p>
                  </div>
                ) : (
                  form.obligations.map((item, index) => (
                    <ObligationEditor
                      key={item.clientKey}
                      obligation={item}
                      index={index}
                      errors={formErrors.obligations?.[index]}
                      disabled={disabled}
                      expanded={isObligationEditorOpen(
                        item,
                        editingObligationKey,
                      )}
                      summary={buildObligationSummary(item, safeToSpend)}
                      onChange={(next) => updateObligation(index, next)}
                      onEdit={() => {
                        setEditingObligationKey(item.clientKey);
                        clearTransientSuccess();
                      }}
                      onCollapse={() => setEditingObligationKey(null)}
                      onRemove={() => handleRemoveObligation(item.clientKey)}
                    />
                  ))
                )}
              </div>
            </section>

            <div className="flex flex-col gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 sm:flex-row sm:items-center sm:justify-between md:p-5">
              <p className="text-sm text-slate-500">Safe to Spend refreshes after a successful save.</p>
              <button
                type="submit"
                disabled={disabled}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:bg-slate-300 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white sm:w-auto"
              >
                {saving ? "Saving plan..." : "Save plan"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Planning;
