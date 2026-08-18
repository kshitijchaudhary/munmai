import {
  buildSafeToSpendViewModel,
  formatCad,
} from "../../utils/planningPage";

const confidenceTone = {
  high: "bg-emerald-50 text-emerald-700",
  estimated: "bg-indigo-50 text-indigo-700",
  incomplete: "bg-amber-50 text-amber-800",
};

const obligationTone = {
  included: "bg-emerald-50 text-emerald-700",
  overdue: "bg-rose-50 text-rose-700",
  excluded: "bg-slate-100 text-slate-600",
  incomplete: "bg-amber-50 text-amber-800",
};

const formatSubtraction = (value) =>
  value === null || value === undefined
    ? "Not available yet"
    : `-${formatCad(value)}`;

const SafeToSpendCard = ({ result, loading, error }) => {
  const view = buildSafeToSpendViewModel(result);
  const negative = Number(result?.safeToSpend) < 0;

  return (
    <section aria-labelledby="safe-to-spend-heading" className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="border-b border-slate-100 p-5 dark:border-slate-800 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p id="safe-to-spend-heading" className="text-xs font-black uppercase tracking-widest text-indigo-600">
            Safe to Spend
          </p>
          {!loading && (
            <span className={`rounded-full px-3 py-1 text-xs font-black ${confidenceTone[view.confidence]}`}>
              {view.confidenceLabel}
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-8" aria-live="polite">
            <p className="font-semibold text-slate-400">Calculating your current plan...</p>
          </div>
        ) : (
          <>
            <p className={`mt-4 break-words text-4xl font-black sm:text-5xl ${negative ? "text-rose-600" : "text-slate-900"}`}>
              {view.amountLabel}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-500">{view.horizonLabel}</p>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {view.incomplete
                ? "This result may not include everything yet. Complete or update your plan below."
                : "This is what remains after obligations due before payday and your essential buffer."}
            </p>
          </>
        )}
      </div>

      {error && (
        <div role="alert" className="border-b border-rose-100 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800 md:px-6">
          {error}
        </div>
      )}

      {!loading && view.warnings.length > 0 && (
        <div className="border-b border-amber-100 bg-amber-50 px-5 py-4 md:px-6">
          <p className="text-sm font-black text-amber-900">Needs attention</p>
          <ul className="mt-2 space-y-2 text-sm text-amber-900">
            {view.warnings.map((warning, index) => (
              <li key={`${warning.code}-${warning.obligationId || index}`} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{warning.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && result && (
        <div className="p-5 md:p-6">
          <h2 className="text-lg font-black text-slate-900">How it is calculated</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-600">Money you have now</dt>
              <dd className="font-black text-slate-900">{formatCad(view.breakdown.currentCash)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-600">Due before payday</dt>
              <dd className="font-black text-slate-900">{formatSubtraction(view.breakdown.includedObligationsTotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-600">Essential buffer</dt>
              <dd className="font-black text-slate-900">{formatSubtraction(view.breakdown.essentialBuffer)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3 dark:border-slate-700">
              <dt className="font-black text-slate-900">Safe to Spend</dt>
              <dd className={`text-lg font-black ${negative ? "text-rose-600" : "text-slate-900"}`}>{view.amountLabel}</dd>
            </div>
          </dl>

          {view.breakdown.obligations.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
              <h3 className="font-black text-slate-900">What's due</h3>
              <div className="mt-3 space-y-3">
                {view.breakdown.obligations.map((item, index) => (
                  <article key={item.id || `${item.name}-${index}`} className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-black text-slate-900">{item.name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {item.dueDateLabel} · {item.certainty}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-900">{item.amountLabel}</p>
                        <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[11px] font-black ${obligationTone[item.status.tone]}`}>
                          {item.status.label}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default SafeToSpendCard;
