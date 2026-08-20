const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

const NextCyclePreview = ({
  confirmReplacement,
  dirty,
  disabled,
  error,
  minPayday,
  nextPayday,
  onCancel,
  onChangePayday,
  onConfirmReplacement,
  onKeepCurrent,
  onRequestPreview,
  onUsePreview,
  preparing,
  preview,
  view,
}) => (
  <section
    aria-labelledby="next-cycle-preview-heading"
    className="rounded-3xl border border-indigo-200 bg-indigo-50/60 p-5 shadow-sm dark:border-indigo-900 dark:bg-indigo-950/20 md:p-6"
  >
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-indigo-600">
          Next planning cycle
        </p>
        <h2
          id="next-cycle-preview-heading"
          className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100"
        >
          Prepare next payday plan
        </h2>
      </div>
      <button
        type="button"
        onClick={onCancel}
        disabled={disabled}
        className="self-start rounded-xl px-3 py-2 text-sm font-black text-slate-600 hover:bg-white disabled:text-slate-300 dark:text-slate-300 dark:hover:bg-slate-900"
      >
        Cancel preview
      </button>
    </div>

    {!preview ? (
      <form onSubmit={onRequestPreview} className="mt-5 space-y-4" noValidate>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Choose the payday for the new cycle. Munmai will prepare only your
          recurring payments for review.
        </p>
        <label className="block" htmlFor="next-cycle-payday">
          <span className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">
            New next payday
          </span>
          <input
            id="next-cycle-payday"
            type="date"
            min={minPayday}
            value={nextPayday}
            onChange={(event) => onChangePayday(event.target.value)}
            disabled={disabled}
            required
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "next-cycle-payday-error" : undefined}
            className={inputClass}
          />
        </label>
        {error && (
          <p
            id="next-cycle-payday-error"
            role="alert"
            className="text-sm font-semibold text-rose-700"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-500 disabled:bg-indigo-300 sm:w-auto"
        >
          {preparing ? "Preparing preview..." : "Preview next plan"}
        </button>
      </form>
    ) : (
      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Munmai prepared your recurring payments for the next cycle. Review
          them before saving.
        </p>

        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">
            <dt className="font-bold text-slate-500">New next payday</dt>
            <dd className="mt-1 font-black text-slate-900 dark:text-slate-100">
              {view.nextPaydayLabel}
            </dd>
          </div>
          <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">
            <dt className="font-bold text-slate-500">Keep for everyday use</dt>
            <dd className="mt-1 font-black text-slate-900 dark:text-slate-100">
              {view.essentialBufferLabel}
            </dd>
          </div>
          <div className="rounded-2xl bg-white p-4 sm:col-span-2 dark:bg-slate-900">
            <dt className="font-bold text-slate-500">Money you have now</dt>
            <dd className="mt-1 font-semibold text-slate-700 dark:text-slate-200">
              {view.currentCashLabel}
            </dd>
          </div>
        </dl>

        {view.warnings.length > 0 && (
          <div
            role="status"
            className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <p className="font-black">Review these dates</p>
            <ul className="mt-2 space-y-1">
              {view.warnings.map((warning, index) => (
                <li key={`${warning.code}-${warning.obligationName || index}`}>
                  {warning.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5">
          <h3 className="font-black text-slate-900 dark:text-slate-100">
            Recurring payments
          </h3>
          {view.obligations.length === 0 ? (
            <p className="mt-2 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
              No recurring payments will be carried into this plan.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {view.obligations.map((obligation, index) => (
                <li
                  key={`${obligation.name}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                >
                  <p className="font-black text-slate-900 dark:text-slate-100">
                    {obligation.name}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {obligation.amountLabel} · {obligation.dueDateLabel}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {obligation.recurrenceLabel}
                  </p>
                  {obligation.newAmountNeeded && (
                    <p className="mt-2 text-xs font-black text-amber-700">
                      Add the new amount after using this plan.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {dirty && !confirmReplacement && (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            Your current form has unsaved changes. They will not be replaced
            unless you explicitly confirm.
          </p>
        )}

        {confirmReplacement ? (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4"
          >
            <p className="text-sm font-black text-rose-900">
              Replace your unsaved changes with this prepared plan?
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onConfirmReplacement}
                className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-600"
              >
                Replace unsaved changes
              </button>
              <button
                type="button"
                onClick={onKeepCurrent}
                className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-black text-rose-800"
              >
                Keep current plan
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onUsePreview}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950"
            >
              Use this plan
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Cancel preview
            </button>
          </div>
        )}
      </div>
    )}
  </section>
);

export default NextCyclePreview;
