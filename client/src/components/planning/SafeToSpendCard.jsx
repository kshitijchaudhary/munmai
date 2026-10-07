import { buildSafeToSpendViewModel, formatCad } from "../../utils/planningPage";

const SafeToSpendCard = ({ result, loading, error, contextLabel = "Saved plan", contextNote = "", onReview }) => {
  const view = buildSafeToSpendViewModel(result);
  return (
    <section aria-labelledby="safe-to-spend-heading" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{contextLabel}</p>
      <h2 id="safe-to-spend-heading" className="mt-3 break-words text-3xl font-black text-slate-900 dark:text-white" aria-live="polite">
        {loading ? "Loading your plan…" : error && !result ? "Saved result unavailable" : view.decisionLabel}
      </h2>
      {!loading && !error && (
        <>
          {view.incomplete ? (
            <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {view.knownShortfallLabel && <p className="font-bold">{view.knownShortfallLabel} · based on known amounts.</p>}
              <p>{view.warnings[0]?.message || "Add your money, payday, and missing payment details."}</p>
              <button type="button" onClick={onReview} className="min-h-11 font-bold underline">Review plan details</button>
            </div>
          ) : null}
          {result?.breakdown?.essentialBuffer != null && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Includes {formatCad(result.breakdown.essentialBuffer)} for everyday spending.</p>
          )}
          {view.confidence === "estimated" && <p className="mt-2 text-xs text-slate-500">Includes estimated payments.</p>}
        </>
      )}
      {contextNote && <p className="mt-3 text-sm text-slate-500">{contextNote}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
      {!loading && result && (
        <details className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
          <summary className="min-h-11 cursor-pointer rounded-lg py-2 font-bold text-slate-700 focus-visible:outline focus-visible:outline-indigo-500 dark:text-slate-200">See breakdown</summary>
          <p className="mt-2 text-sm text-slate-500">Saved money minus included payments and your everyday allowance. Any remainder is extra; any shortfall includes the allowance. Overdue payments and payments due on payday are included.</p>
          <dl className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
            {[
              ["Money you have now", view.breakdown.currentCash],
              ["Needs paying", view.breakdown.includedObligationsTotal],
              ["Set aside for everyday spending", view.breakdown.essentialBuffer],
            ].map(([label, value], index) => (
              <div key={label} className="flex flex-wrap justify-between gap-2">
                <dt>{label}</dt><dd className="font-bold">{index > 0 && value != null ? "−" : ""}{formatCad(value)}</dd>
              </div>
            ))}
            <div className="flex flex-wrap justify-between gap-2 border-t pt-3"><dt>{view.incomplete ? "Based on known amounts" : "Remaining after payments and allowance"}</dt><dd className="font-bold">{view.amountLabel}</dd></div>
          </dl>
          {view.warnings.length > 0 && <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-amber-800">{view.warnings.map((warning, index) => <li key={`${warning.code}-${index}`}>{warning.message}</li>)}</ul>}
        </details>
      )}
    </section>
  );
};

export default SafeToSpendCard;
