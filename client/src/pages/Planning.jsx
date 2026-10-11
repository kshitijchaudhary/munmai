import { useBlocker, useBeforeUnload } from "react-router-dom";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../context/authContext";
import * as planningApi from "../api/planning";
import NextCyclePreview from "../components/planning/NextCyclePreview";
import ObligationEditor from "../components/planning/ObligationEditor";
import SafeToSpendCard from "../components/planning/SafeToSpendCard";
import Sidebar from "../components/Sidebar";
import {
  PlanningFormValidationError,
  NextCyclePreviewValidationError,
  addPaymentDraftToPlan,
  createEmptyObligation,
  buildNextCyclePreviewViewModel,
  buildObligationSummary,
  createPlanningFormFromPreview,
  createSubmissionGuard,
  createEmptyPlanningForm,
  findFirstInvalidObligationKey,
  formatCad,
  formatPlanDetailsDate,
  isStrictCalendarDate,
  getApiErrorMessage,
  getSaveOutcomeMessage,
  getTodayCalendarDate,
  getPlanningChangeState,
  isObligationEditorOpen,
  isPlanningFormDirty,
  isPlanningPaymentDirty,
  isPlanningExperienceComplete,
  loadPlanningExperience,
  orderPlanningObligations,
  removeObligation,
  requestNextCyclePreview,
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
  const { logout } = useContext(AuthContext);
  const [signOutRequested, setSignOutRequested] = useState(false);
  const [form, setForm] = useState(createEmptyPlanningForm);
  const [task, setTask] = useState({ kind: 'summary' });
  const previousPreparationTask = useRef({ kind: 'summary' });
  const previousPaymentTask = useRef({ kind: 'summary' });
  const planEditing = task.kind === 'details';
  const editingObligationKey = task.kind === 'payment' ? task.key : null;
  const prepareNextCycleOpen = task.kind === 'prepare';
  const [laterOpen, setLaterOpen] = useState(false);
  const [newPayment, setNewPayment] = useState(null);
  const [newPaymentErrors, setNewPaymentErrors] = useState({});
  const [newPaymentMessage, setNewPaymentMessage] = useState("");
  const newPaymentRef = useRef(null);
  const addPaymentButtonRef = useRef(null);
  const restoreAddPaymentFocusRef = useRef(false);
  const [formErrors, setFormErrors] = useState({ obligations: [] });
  const [safeToSpend, setSafeToSpend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshIncomplete, setRefreshIncomplete] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [resultError, setResultError] = useState("");
  const [message, setMessage] = useState(null);
  const [nextCyclePayday, setNextCyclePayday] = useState("");
  const [nextCyclePreview, setNextCyclePreview] = useState(null);
  const [nextCycleError, setNextCycleError] = useState("");
  const [preparingNextCycle, setPreparingNextCycle] = useState(false);
  const [confirmPreviewReplacement, setConfirmPreviewReplacement] =
    useState(false);
  const [preparedPlanActive, setPreparedPlanActive] = useState(false);
  const savingGuardRef = useRef(createSubmissionGuard());
  const savedFormRef = useRef(null);
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
    if (isPlanningExperienceComplete(loaded)) {
      setForm(loaded.form);
      savedFormRef.current = loaded.form;
      setSafeToSpend(loaded.safeToSpend);
      setTask({ kind: loaded.form.nextPayday ? 'summary' : 'details' });
      setNextCyclePreview(null);
      setPreparedPlanActive(false);
      setRefreshIncomplete(false);
    } else {
      // Never combine a successful read with an older or failed counterpart.
      setSafeToSpend(null);
    }

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

  const retryRefresh = async () => {
    setLoading(true);
    const loaded = await loadPlanningExperience(planningApi);
    if (isPlanningExperienceComplete(loaded)) {
      applyLoadedExperience(loaded);
      setMessage({ type: 'success', text: 'Saved result refreshed.' });
    } else {
      setSafeToSpend(null);
      setResultError('Plan saved. Couldn’t refresh the result.');
    }
    setLoading(false);
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: "" }));
    clearTransientSuccess();
  };

  const updateObligation = (index, obligation) => {
    if (obligation.dueDate > form.nextPayday) setLaterOpen(true);
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
    if (editingObligationKey === clientKey) setTask({ kind: 'summary' });
    clearTransientSuccess();
  };

  const focusNewPayment = (field = 'name') => {
    const input = newPaymentRef.current?.querySelector(`[id$="-${field}"]`);
    input?.focus();
    input?.scrollIntoView({ block: 'nearest' });
  };
  const newPaymentKey = newPayment?.clientKey;
  useEffect(() => {
    if (newPaymentKey) focusNewPayment();
    else if (restoreAddPaymentFocusRef.current) {
      restoreAddPaymentFocusRef.current = false;
      addPaymentButtonRef.current?.focus();
    }
  }, [newPaymentKey, task.kind]);
  useEffect(() => {
    const firstError = Object.keys(newPaymentErrors).find((field) => newPaymentErrors[field]);
    if (firstError) focusNewPayment(firstError);
  }, [newPaymentErrors]);

  const handleAddObligation = () => {
    if (task.kind !== 'new-payment') previousPaymentTask.current = task;
    setTask({ kind: 'new-payment' });
    setNewPayment((current) => current ?? createEmptyObligation());
    focusNewPayment();
    clearTransientSuccess();
  };
  const cancelNewPayment = () => {
    restoreAddPaymentFocusRef.current = true;
    setNewPayment(null);
    setNewPaymentErrors({});
    setNewPaymentMessage('');
    setTask(previousPaymentTask.current);
  };
  const handleAddToPlan = () => {
    const added = addPaymentDraftToPlan(form, newPayment);
    if (!added.added) {
      setNewPaymentErrors(added.errors);
      setNewPaymentMessage('Complete the highlighted payment details.');
      return;
    }
    // The duplicate-key guard also protects two clicks before the form closes.
    setForm((current) => addPaymentDraftToPlan(current, newPayment).form);
    setFormErrors((current) => ({ ...current, obligations: [] }));
    if (newPayment.dueDate > form.nextPayday) setLaterOpen(true);
    cancelNewPayment();
    clearTransientSuccess();
  };

  const cancelNextCyclePreview = () => {
    setTask(previousPreparationTask.current);
    setConfirmPreviewReplacement(false);
  };
  const backNextCyclePreview = () => {
    if (nextCyclePreview) {
      setNextCyclePreview(null);
      setConfirmPreviewReplacement(false);
    } else cancelNextCyclePreview();
  };
  const handleStartNextCyclePreview = () => {
    previousPreparationTask.current = task;
    setTask({ kind: 'prepare' });
    clearTransientSuccess();
  };

  const handleRequestNextCyclePreview = async (event) => {
    event.preventDefault();
    setPreparingNextCycle(true);
    setNextCycleError("");
    setConfirmPreviewReplacement(false);

    try {
      const preview = await requestNextCyclePreview(
        nextCyclePayday,
        planningApi,
        { currentPayday: savedFormRef.current?.nextPayday },
      );
      setNextCyclePreview(preview);
    } catch (error) {
      setNextCycleError(
        error instanceof NextCyclePreviewValidationError
          ? error.message
          : getApiErrorMessage(error, "Could not prepare the next plan."),
      );
    } finally {
      setPreparingNextCycle(false);
    }
  };

  const applyNextCyclePreview = () => {
    const preparedForm = createPlanningFormFromPreview(nextCyclePreview);
    setForm(preparedForm);
    setFormErrors({ obligations: [] });
    setPreparedPlanActive(true);
    setTask({ kind: 'details' });
    setNewPayment(null);
    setNewPaymentErrors({});
    setNewPaymentMessage('');
    setNextCycleError('');
    setConfirmPreviewReplacement(false);
    setMessage({
      type: "info",
      text: "Prepared plan ready. Enter your current cash, review payment details, then save the plan.",
    });
  };

  const formDirty = isPlanningFormDirty(form, savedFormRef.current);
  const { detailsDirty, paymentsDirty } = getPlanningChangeState(form, savedFormRef.current);

  const pendingChanges = formDirty || newPayment !== null || preparedPlanActive;
  const leaveDialogRef = useRef(null);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    (pendingChanges || saving) && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));
  useEffect(() => {
    if (blocker.state === 'blocked' || signOutRequested) {
      if (!pendingChanges && !saving) {
        if (signOutRequested) logout(); else blocker.reset();
        return;
      }
      if (!leaveDialogRef.current?.open) leaveDialogRef.current?.showModal();
    }
  }, [blocker, pendingChanges, saving, signOutRequested, logout]);
  useBeforeUnload(useCallback((event) => {
    if (pendingChanges || saving) { event.preventDefault(); event.returnValue = ''; }
  }, [pendingChanges, saving]));

  const handleUseNextCyclePreview = () => {
    if (preparedPlanActive && nextCyclePreview?.planning?.nextPayday === form.nextPayday) {
      setTask({ kind: 'details' });
      return;
    }
    if (formDirty || newPayment !== null) {
      setConfirmPreviewReplacement(true);
      return;
    }

    applyNextCyclePreview();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (newPayment) {
      setNewPaymentMessage('Add this payment to the plan or cancel it before saving.');
      setTask({ kind: 'new-payment' });
      focusNewPayment();
      return;
    }
    if (!savingGuardRef.current.acquire()) return;

    cancelSuccessTimer();
    setMessage(null);

    const validation = validatePlanningForm(form);

    if (!validation.valid) {
      savingGuardRef.current.release();
      setFormErrors(validation.errors);
      const invalidKey = findFirstInvalidObligationKey(form, validation.errors);
      setTask(invalidKey ? { kind: 'payment', key: invalidKey } : { kind: 'details' });
      setLaterOpen(true);
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
      const outcome = getSaveOutcomeMessage(loaded);

      if (outcome.type === "error") {
        // Keep the acknowledged saved baseline; neither partial read is verified.
        setRefreshIncomplete(true);
        setPreparedPlanActive(false);
        setTask({ kind: 'summary' });
        savedFormRef.current = loaded.savedForm;
        setForm(loaded.savedForm);
        setSafeToSpend(null);
        setResultError("Plan saved. Couldn’t refresh the result.");
        setMessage(null);
        setFormErrors({ obligations: [] });
      } else {
        applyLoadedExperience(loaded);
        setFormErrors({ obligations: [] });
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

  const disabled = loading || saving || preparingNextCycle;
  const previewView = nextCyclePreview
    ? buildNextCyclePreviewViewModel(nextCyclePreview)
    : null;
  const orderedObligations = orderPlanningObligations(form);

  const laterRows = orderedObligations.filter(({ obligation }) => isStrictCalendarDate(form.nextPayday) && isStrictCalendarDate(obligation.dueDate) && obligation.dueDate > form.nextPayday);
  const currentRows = orderedObligations.filter((row) => !laterRows.includes(row));
  const cancelEdits = () => {
    if (!savedFormRef.current) return;
    setForm(structuredClone(savedFormRef.current));
    setFormErrors({ obligations: [] });
    setTask({ kind: savedFormRef.current.nextPayday ? 'summary' : 'details' });
    setPreparedPlanActive(false);
    setNewPayment(null);
    setNewPaymentErrors({});
    setNewPaymentMessage("");
    clearTransientSuccess();
    setMessage(null);
  };
  // Keep planEditing and the form untouched while the separate payment draft is open.
  const newPaymentActive = task.kind === 'new-payment' && newPayment !== null;
  const detailsEditorVisible = planEditing;
  const detailsOwnSaveControls = detailsEditorVisible && (detailsDirty || refreshIncomplete || preparedPlanActive);
  const saveControls = (formDirty || saving) && !newPaymentActive && !prepareNextCycleOpen ? <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
              {message && <p role={message.type === "error" ? "alert" : "status"} className="mt-2 text-sm">{message.text}</p>}
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="submit" disabled={disabled} className="min-h-11 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950">{saving ? "Saving plan..." : detailsDirty && paymentsDirty ? "Save all changes" : "Save plan"}</button>
                <button type="button" disabled={disabled} onClick={cancelEdits} className="min-h-11 rounded-xl border px-5 py-3 font-bold dark:text-white">Cancel all changes</button>
              </div>
            </div> : null;

  const renderPayment = ({ obligation: item, index }) => (
    <ObligationEditor key={item.clientKey} obligation={item} index={index}
      errors={formErrors.obligations?.[index]} disabled={disabled}
      expanded={isObligationEditorOpen(item, editingObligationKey)}
      summary={buildObligationSummary(item, safeToSpend, { draft: isPlanningPaymentDirty(item, savedFormRef.current) })}
      onChange={(next) => updateObligation(index, next)}
      onEdit={() => { setTask({ kind: 'payment', key: item.clientKey }); clearTransientSuccess(); }}
      onCollapse={() => setTask({ kind: 'summary' })}
      onRemove={() => handleRemoveObligation(item.clientKey)} />
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20 dark:bg-slate-950">
      <Sidebar onSignOut={() => pendingChanges || saving ? setSignOutRequested(true) : logout()} />
      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8 md:px-6 lg:ml-72 lg:w-auto">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">Your payday plan</h1>
        {loadError && <div role="alert" className="text-sm text-rose-700">{loadError} <button type="button" disabled={disabled || formDirty || newPayment !== null} onClick={loadPage} className="min-h-11 underline">Try again</button></div>}
        {preparedPlanActive && !prepareNextCycleOpen && <button type="button" onClick={() => setTask({ kind: 'prepare' })} className="min-h-11 rounded-xl border px-4 py-2 dark:text-white">Back to preview</button>}
        {pendingChanges && <p role="status" className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Unsaved changes</p>}
        {resultError && !refreshIncomplete && <button type="button" onClick={loadPage} disabled={disabled || pendingChanges} className="min-h-11 rounded-xl border px-4 py-2 dark:text-white">Try again</button>}
        {refreshIncomplete && <button type="button" onClick={retryRefresh} disabled={disabled || pendingChanges} className="min-h-11 rounded-xl border px-4 py-2 font-bold dark:text-white">Retry refresh</button>}
        {newPayment && !newPaymentActive && !prepareNextCycleOpen && <button type="button" onClick={handleAddObligation} className="min-h-11 rounded-xl border px-4 py-2 dark:text-white">Resume payment draft</button>}
        <SafeToSpendCard result={safeToSpend} loading={loading} error={resultError}
          contextLabel="Current saved plan"
          contextNote={preparedPlanActive ? "Saved result · prepared plan not yet saved." : formDirty ? "Saved result · edits not included." : prepareNextCycleOpen ? "Saved result · preview not included." : ""}
          onReview={() => { setTask({ kind: 'details' }); document.getElementById('planning-editor')?.scrollIntoView({ block: 'start' }); }} />
        {!loading && savedFormRef.current && !prepareNextCycleOpen && (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <section id="planning-editor" className="rounded-3xl border border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{detailsEditorVisible ? "Edit plan" : "Plan details"}</h2>
                {!newPaymentActive && (!planEditing || (!detailsDirty && !preparedPlanActive)) && (
                  <button type="button" disabled={disabled} aria-expanded={planEditing} aria-controls="plan-fields" onClick={() => setTask({ kind: planEditing ? 'summary' : 'details' })} className="min-h-11 rounded-xl border px-4 py-2 font-semibold dark:text-white">{planEditing ? "Close" : "Edit plan"}</button>
                )}
              </div>
              {detailsEditorVisible ? <div id="plan-fields">              <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                <label className="block md:col-span-2" htmlFor="planning-current-cash">
                  <span className="mb-1 block text-sm font-bold text-slate-700">How much money do you have now?</span>
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
                    Include the money available to use before your next payday.
                  </p>
                  <FieldError id="planning-current-cash-error" message={formErrors.currentCash} />
                </label>

                <label className="block" htmlFor="planning-next-payday">
                  <span className="mb-1 block text-sm font-bold text-slate-700">When is your next payday?</span>
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
                  <span className="mb-1 block text-sm font-bold text-slate-700">Set aside for everyday spending</span>
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
                    Money for groceries, transport, and unexpected costs until your next payday. Don’t include bills already listed below.
                  </p>
                  <FieldError id="planning-essential-buffer-error" message={formErrors.essentialBuffer} />
                </label>
              </div></div> : (
                <dl className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                  <div><dt>Money available now</dt><dd className="font-bold">{formatCad(savedFormRef.current.currentCash)}</dd></div>
                  <div><dt>Next payday</dt><dd className="font-bold">{formatPlanDetailsDate(savedFormRef.current.nextPayday)}</dd></div>
                  <div><dt>Set aside for everyday spending</dt><dd className="font-bold">{formatCad(savedFormRef.current.essentialBuffer)}</dd></div>
                </dl>
              )}
              {detailsOwnSaveControls && saveControls}
            </section>
            <section id="planning-payments" className="rounded-3xl border border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Payments</h2>
                {!newPaymentActive && <button type="button" ref={addPaymentButtonRef} aria-expanded={newPaymentActive} aria-controls="new-payment-editor" onClick={handleAddObligation} disabled={disabled} className="min-h-11 rounded-xl border px-4 py-2 font-bold dark:text-white">+ Add payment</button>}
              </div>
              {!detailsOwnSaveControls && saveControls}
              {newPaymentActive && (
                <div id="new-payment-editor" ref={newPaymentRef} className="mt-4">
                  <ObligationEditor obligation={newPayment} index={form.obligations.length}
                    errors={newPaymentErrors} disabled={disabled} expanded newPayment
                    onChange={(next) => { setNewPayment(next); setNewPaymentErrors({}); setNewPaymentMessage(''); }}
                    onAddToPlan={handleAddToPlan} onCancelNew={cancelNewPayment} />
                  {newPaymentMessage && <p role="alert" className="mt-2 text-sm text-rose-700">{newPaymentMessage}</p>}
                </div>
              )}
              <div className="mt-3 space-y-3">{currentRows.map(renderPayment)}</div>
              {form.obligations.length === 0 && <p className="mt-3 text-sm text-slate-500">No payments added.</p>}
              {laterRows.length > 0 && <details open={laterOpen} onToggle={(event) => setLaterOpen(event.currentTarget.open)} className="mt-4">
                <summary className="min-h-11 cursor-pointer rounded-lg py-2 font-bold text-slate-700 focus-visible:outline focus-visible:outline-indigo-500 dark:text-slate-200">Later payments ({laterRows.length})</summary>
                <div className="mt-3 space-y-3">{laterRows.map(renderPayment)}</div>
              </details>}
            </section>

          </form>
        )}
        {!saveControls && message && <p role={message.type === "error" ? "alert" : "status"} className="text-sm text-slate-600">{message.text}</p>}
        {!loading && !saving && !refreshIncomplete && savedFormRef.current?.nextPayday && !prepareNextCycleOpen && !preparedPlanActive && (
          <button type="button" onClick={handleStartNextCyclePreview} disabled={disabled} className="min-h-11 rounded-lg px-2 py-2 text-sm font-semibold text-slate-600 underline dark:text-slate-300">Prepare next payday plan</button>
        )}
            {prepareNextCycleOpen && (
              <NextCyclePreview
                confirmReplacement={confirmPreviewReplacement}
                dirty={formDirty || newPayment !== null}
                disabled={disabled}
                error={nextCycleError}
                minPayday={getTodayCalendarDate()}
                nextPayday={nextCyclePayday}
                onCancel={cancelNextCyclePreview}
                onBack={backNextCyclePreview}
                onChangePayday={(value) => {
                  setNextCyclePayday(value);
                  setNextCycleError("");
                }}
                onConfirmReplacement={applyNextCyclePreview}
                onKeepCurrent={cancelNextCyclePreview}
                onRequestPreview={handleRequestNextCyclePreview}
                onUsePreview={handleUseNextCyclePreview}
                preparing={preparingNextCycle}
                preview={nextCyclePreview}
                view={previewView}
              />
            )}


        {(blocker.state === 'blocked' || signOutRequested) && (
          <dialog ref={leaveDialogRef} onCancel={(event) => { event.preventDefault(); if (signOutRequested) setSignOutRequested(false); else blocker.reset(); }} aria-modal="true" aria-labelledby="leave-planning-title" className="fixed inset-0 z-50 m-auto max-w-sm rounded-2xl border bg-white p-6 shadow-xl dark:bg-slate-900 dark:text-white">
            <h2 id="leave-planning-title" className="font-bold">Leave your payday plan?</h2>
            <p className="mt-2 text-sm">Your unsaved changes will be discarded.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" autoFocus onClick={() => signOutRequested ? setSignOutRequested(false) : blocker.reset()} className="min-h-11 rounded-xl border px-4 py-2">Stay</button>
              <button type="button" disabled={saving} onClick={() => signOutRequested ? logout() : blocker.proceed()} className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 text-white">Discard and leave</button>
            </div>
          </dialog>
        )}

      </main>
    </div>
  );
};

export default Planning;
