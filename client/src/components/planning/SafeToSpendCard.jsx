import {
  buildSafeToSpendViewModel,
  formatCad,
} from "../../utils/planningPage";

const formatSubtraction = (value) =>
  value === null || value === undefined
    ? "Not available yet"
    : `-${formatCad(value)}`;

const ObligationRow = ({ item, showOverdue = false }) => (
  <li className="flex min-w-0 flex-col gap-1 rounded-2xl border border-slate-100 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
    <div className="min-w-0">
      <p className="break-words font-black text-slate-900 dark:text-slate-100">
        {item.name}
      </p>
      <p className="mt-0.5 text-xs font-semibold text-slate-500">
        {showOverdue && item.status.tone === "overdue"
          ? "Overdue"
          : item.shortDueDateLabel}
      </p>
    </div>
    <p className="shrink-0 font-black text-slate-900 dark:text-slate-100">
      {item.amountLabel}
    </p>
  </li>
);

const SafeToSpendCard = ({
  result,
  loading,
  error,
  contextLabel = "Before payday",
  contextNote = "",
}) => {
  const view = buildSafeToSpendViewModel(result);
  const negative = Number(result?.safeToSpend) < 0;

  return (
    <section
      aria-labelledby="safe-to-spend-heading"
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
    >
      <div className="border-b border-slate-100 p-5 dark:border-slate-800 md:p-6">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-600">
          {contextLabel}
        </p>
        {contextNote && (
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {contextNote}
          </p>
        )}

        {loading ? (
          <div className="py-8" aria-live="polite">
            <p className="font-semibold text-slate-400">
              Working out what is safe to spend...
            </p>
          </div>
        ) : (
          <>
            <h2
              id="safe-to-spend-heading"
              className={`mt-3 break-words text-3xl font-black leading-tight sm:text-4xl ${negative ? "text-rose-600" : "text-slate-900"}`}
            >
              {view.decisionLabel}
            </h2>
            <p className="mt-3 text-sm font-black text-slate-600">
              {view.horizonLabel}
            </p>

            {view.confidence === "high" && !view.incomplete && (
              <p className="mt-3 text-sm text-slate-500">
                {view.confidenceLabel}
              </p>
            )}

            {view.confidence === "estimated" && (
              <p className="mt-3 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                {view.confidenceLabel}
              </p>
            )}

            {view.incomplete && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-black">Some upcoming costs are still unknown.</p>
                <p className="mt-1">Your Safe-to-Spend amount may change.</p>
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="border-b border-rose-100 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800 md:px-6"
        >
          {error}
        </div>
      )}

      {!loading && view.warnings.length > 0 && (
        <div className="border-b border-amber-100 bg-amber-50 px-5 py-4 md:px-6">
          <p className="text-sm font-black text-amber-900">Needs attention</p>
          <ul className="mt-2 space-y-2 text-sm text-amber-900">
            {view.warnings.map((warning, index) => (
              <li
                key={`${warning.code}-${warning.obligationId || index}`}
                className="flex gap-2"
              >
                <span aria-hidden="true">•</span>
                <span>{warning.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && result && (
        <div className="space-y-6 p-5 md:p-6">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              How the number works
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-600">Money you have now</dt>
                <dd className="font-black text-slate-900 dark:text-slate-100">
                  {formatCad(view.breakdown.currentCash)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-600">Needs paying</dt>
                <dd className="font-black text-slate-900 dark:text-slate-100">
                  {formatSubtraction(view.breakdown.includedObligationsTotal)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-600">Keep for everyday use</dt>
                <dd className="font-black text-slate-900 dark:text-slate-100">
                  {formatSubtraction(view.breakdown.essentialBuffer)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3 dark:border-slate-700">
                <dt className="font-black text-slate-900 dark:text-slate-100">
                  Safe to spend
                </dt>
                <dd
                  className={`text-lg font-black ${negative ? "text-rose-600" : "text-slate-900 dark:text-slate-100"}`}
                >
                  {view.amountLabel}
                </dd>
              </div>
            </dl>
          </div>

          {view.breakdown.includedObligations.length > 0 && (
            <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h3 className="font-black text-slate-900 dark:text-slate-100">
                  Needs paying before payday
                </h3>
                <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                  Total {formatCad(view.breakdown.includedObligationsTotal)}
                </p>
              </div>
              <ul className="mt-3 space-y-2">
                {view.breakdown.includedObligations.map((item, index) => (
                  <ObligationRow
                    key={item.id || `${item.name}-${index}`}
                    item={item}
                    showOverdue
                  />
                ))}
              </ul>
            </div>
          )}

          {view.breakdown.laterObligations.length > 0 && (
            <details className="border-t border-slate-100 pt-5 dark:border-slate-800">
              <summary className="cursor-pointer rounded-lg font-black text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:text-slate-200">
                Later — after next payday ({view.breakdown.laterObligations.length})
              </summary>
              <ul className="mt-3 space-y-2">
                {view.breakdown.laterObligations.map((item, index) => (
                  <ObligationRow
                    key={item.id || `${item.name}-${index}`}
                    item={item}
                  />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
};

export default SafeToSpendCard;
