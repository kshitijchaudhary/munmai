import {
  PLANNING_AMOUNT_TYPES,
  PLANNING_CADENCES,
  PLANNING_CATEGORIES,
  PLANNING_CERTAINTIES,
  getCompactPaymentStatus,
  updateObligationRecurrence,
} from "../../utils/planningPage";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-950 dark:disabled:bg-slate-800";

const certaintyHelp = {
  confirmed: "Use this when you know the amount.",
  estimated: "Use your best estimate for now.",
  unknown: "You can leave the amount and date blank.",
};

const statusTone = {
  included: "bg-emerald-50 text-emerald-700",
  overdue: "bg-rose-50 text-rose-700",
  excluded: "bg-slate-100 text-slate-600",
  incomplete: "bg-amber-50 text-amber-800",
};

const FieldError = ({ id, message }) =>
  message ? (
    <p id={id} role="alert" className="mt-1 text-xs font-semibold text-rose-600">
      {message}
    </p>
  ) : null;

const ObligationEditor = ({
  obligation,
  index,
  errors = {},
  disabled,
  expanded,
  summary,
  onChange,
  onEdit,
  onCollapse,
  onRemove,
}) => {
  const known =
    obligation.certainty === "confirmed" || obligation.certainty === "estimated";
  const fieldId = (field) => `obligation-${obligation.clientKey}-${field}`;
  const update = (field, value) => onChange({ ...obligation, [field]: value });

  if (!expanded) {
    const headingId = fieldId("summary-heading");
    const summaryStatus = getCompactPaymentStatus(summary.status);

    return (
      <article
        aria-labelledby={headingId}
        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/40"
      >
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3
              id={headingId}
              className="break-words font-black text-slate-900 dark:text-slate-100"
            >
              {summary.name}
            </h3>
            <p className="mt-1 break-words text-sm font-semibold text-slate-500">
              {summary.amountLabel} · {summary.dueDateLabel}
            </p>
            {summary.recurrenceLabel && (
              <p className="mt-1 break-words text-xs font-bold text-slate-500">
                {summary.recurrenceLabel}
              </p>
            )}
            <span
              className={`mt-2 inline-block max-w-full rounded-full px-2.5 py-1 text-[11px] font-black ${statusTone[summary.status.tone] || statusTone.incomplete}`}
            >
              {summaryStatus}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
            <button
              type="button"
              onClick={onEdit}
              disabled={disabled}
              aria-label={`Edit ${summary.name}`}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:text-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              aria-label={`Remove ${summary.name}`}
              className="rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:text-slate-300 dark:hover:bg-rose-950/30"
            >
              Remove
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <fieldset className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/40 md:p-5">
      <legend className="sr-only">Payment {index + 1}</legend>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
            Payment {index + 1}
          </p>
          {obligation._id && (
            <p className="mt-1 text-xs text-slate-400">Saved payment</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCollapse}
            disabled={disabled}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:text-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Done editing
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:text-slate-300 dark:hover:bg-rose-950/30"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block md:col-span-2" htmlFor={fieldId("name")}>
          <span className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">
            What is it?
          </span>
          <input
            id={fieldId("name")}
            value={obligation.name}
            onChange={(event) => update("name", event.target.value)}
            disabled={disabled}
            maxLength={200}
            placeholder="Phone, car payment, Amex"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${fieldId("name")}-error` : undefined}
            className={inputClass}
          />
          <FieldError id={`${fieldId("name")}-error`} message={errors.name} />
        </label>

        <label className="block" htmlFor={fieldId("amount")}>
          <span className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">
            How much? {known ? "" : "(optional)"}
          </span>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-3 text-sm font-bold text-slate-400">
              $
            </span>
            <input
              id={fieldId("amount")}
              type="number"
              min="0.01"
              step="0.01"
              value={obligation.amount}
              onChange={(event) => update("amount", event.target.value)}
              disabled={disabled}
              required={known}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={errors.amount ? `${fieldId("amount")}-error` : undefined}
              className={`${inputClass} pl-8`}
            />
          </div>
          <FieldError id={`${fieldId("amount")}-error`} message={errors.amount} />
        </label>

        <label className="block" htmlFor={fieldId("dueDate")}>
          <span className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-200">
            When is it due? {known ? "" : "(optional)"}
          </span>
          <input
            id={fieldId("dueDate")}
            type="date"
            value={obligation.dueDate}
            onChange={(event) => update("dueDate", event.target.value)}
            disabled={disabled}
            required={known}
            aria-invalid={Boolean(errors.dueDate)}
            aria-describedby={errors.dueDate ? `${fieldId("dueDate")}-error` : undefined}
            className={inputClass}
          />
          <FieldError id={`${fieldId("dueDate")}-error`} message={errors.dueDate} />
        </label>

        <fieldset className="md:col-span-2">
          <legend className="text-sm font-bold text-slate-700 dark:text-slate-200">
            How certain is the amount?
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PLANNING_CERTAINTIES.map((item) => (
              <label
                key={item.value}
                className="flex cursor-pointer items-start gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <input
                  type="radio"
                  name={fieldId("certainty")}
                  value={item.value}
                  checked={obligation.certainty === item.value}
                  onChange={(event) => update("certainty", event.target.value)}
                  disabled={disabled}
                  className="mt-0.5 accent-indigo-600"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {certaintyHelp[obligation.certainty]}
          </p>
          <FieldError
            id={`${fieldId("certainty")}-error`}
            message={errors.certainty}
          />
        </fieldset>

        <details
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 md:col-span-2"
          open={
            errors.category ||
            errors.note ||
            errors.amountType ||
            errors.cadence
              ? true
              : undefined
          }
        >
          <summary className="cursor-pointer rounded-lg text-sm font-black text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:text-slate-300">
            More options
          </summary>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <fieldset className="border-b border-slate-100 pb-4 dark:border-slate-800 md:col-span-2">
              <legend className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Does this payment repeat?
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { label: "No", value: false },
                  { label: "Yes", value: true },
                ].map((item) => (
                  <label
                    key={item.label}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50 dark:border-slate-700 dark:text-slate-200"
                  >
                    <input
                      type="radio"
                      name={fieldId("recurring")}
                      checked={obligation.recurring === item.value}
                      onChange={() =>
                        onChange(
                          updateObligationRecurrence(obligation, item.value),
                        )
                      }
                      disabled={disabled}
                      className="accent-indigo-600"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {obligation.recurring && (
              <>
                <fieldset
                  aria-invalid={Boolean(errors.amountType)}
                  aria-describedby={
                    errors.amountType
                      ? `${fieldId("amountType")}-error`
                      : undefined
                  }
                >
                  <legend className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    Does the amount usually stay the same?
                  </legend>
                  <div className="mt-2 space-y-2">
                    {PLANNING_AMOUNT_TYPES.map((item) => (
                      <label
                        key={item.value}
                        className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50 dark:border-slate-700 dark:text-slate-200"
                      >
                        <input
                          type="radio"
                          name={fieldId("amountType")}
                          value={item.value}
                          checked={obligation.amountType === item.value}
                          onChange={(event) =>
                            update("amountType", event.target.value)
                          }
                          disabled={disabled}
                          className="accent-indigo-600"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                  <FieldError
                    id={`${fieldId("amountType")}-error`}
                    message={errors.amountType}
                  />
                </fieldset>

                <label className="block" htmlFor={fieldId("cadence")}>
                  <span className="mb-1 block text-sm font-bold text-slate-600 dark:text-slate-300">
                    How often?
                  </span>
                  <select
                    id={fieldId("cadence")}
                    value={obligation.cadence}
                    onChange={(event) => update("cadence", event.target.value)}
                    disabled={disabled}
                    aria-invalid={Boolean(errors.cadence)}
                    aria-describedby={
                      errors.cadence
                        ? `${fieldId("cadence")}-error`
                        : undefined
                    }
                    className={inputClass}
                  >
                    <option value="">Choose frequency</option>
                    {PLANNING_CADENCES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <FieldError
                    id={`${fieldId("cadence")}-error`}
                    message={errors.cadence}
                  />
                </label>
              </>
            )}

            <label className="block" htmlFor={fieldId("category")}>
              <span className="mb-1 block text-sm font-bold text-slate-600 dark:text-slate-300">
                Category
              </span>
              <select
                id={fieldId("category")}
                value={obligation.category}
                onChange={(event) => update("category", event.target.value)}
                disabled={disabled}
                className={inputClass}
              >
                {PLANNING_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <FieldError
                id={`${fieldId("category")}-error`}
                message={errors.category}
              />
            </label>

            <label className="block" htmlFor={fieldId("note")}>
              <span className="mb-1 block text-sm font-bold text-slate-600 dark:text-slate-300">
                Note (optional)
              </span>
              <textarea
                id={fieldId("note")}
                value={obligation.note}
                onChange={(event) => update("note", event.target.value)}
                disabled={disabled}
                maxLength={500}
                rows={2}
                placeholder="Optional context"
                className={`${inputClass} resize-none`}
              />
              <FieldError id={`${fieldId("note")}-error`} message={errors.note} />
            </label>
          </div>
        </details>
      </div>
    </fieldset>
  );
};

export default ObligationEditor;
