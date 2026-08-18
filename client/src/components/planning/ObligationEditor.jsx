import {
  PLANNING_CATEGORIES,
  PLANNING_CERTAINTIES,
} from "../../utils/planningPage";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-950 dark:disabled:bg-slate-800";

const certaintyHelp = {
  confirmed: "You know the amount and due date.",
  estimated: "Protect an approximate amount until payday.",
  unknown: "The amount or date is not fully known yet.",
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
  onChange,
  onRemove,
}) => {
  const known =
    obligation.certainty === "confirmed" || obligation.certainty === "estimated";
  const fieldId = (field) => `obligation-${obligation.clientKey}-${field}`;

  const update = (field, value) => onChange({ ...obligation, [field]: value });

  return (
    <fieldset className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/40 md:p-5">
      <legend className="sr-only">Obligation {index + 1}</legend>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
            Obligation {index + 1}
          </p>
          {obligation._id && (
            <p className="mt-1 text-xs text-slate-400">Saved obligation</p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="rounded-xl px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:text-slate-300 dark:hover:bg-rose-950/30"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block md:col-span-2" htmlFor={fieldId("name")}>
          <span className="mb-1 block text-sm font-bold text-slate-700">Name</span>
          <input
            id={fieldId("name")}
            value={obligation.name}
            onChange={(event) => update("name", event.target.value)}
            disabled={disabled}
            maxLength={200}
            placeholder="Phone bill, car payment, Amex statement"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${fieldId("name")}-error` : undefined}
            className={inputClass}
          />
          <FieldError id={`${fieldId("name")}-error`} message={errors.name} />
        </label>

        <label className="block" htmlFor={fieldId("certainty")}>
          <span className="mb-1 block text-sm font-bold text-slate-700">Certainty</span>
          <select
            id={fieldId("certainty")}
            value={obligation.certainty}
            onChange={(event) => update("certainty", event.target.value)}
            disabled={disabled}
            className={inputClass}
          >
            {PLANNING_CERTAINTIES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {certaintyHelp[obligation.certainty]}
          </p>
        </label>

        <label className="block" htmlFor={fieldId("category")}>
          <span className="mb-1 block text-sm font-bold text-slate-700">Category</span>
          <select
            id={fieldId("category")}
            value={obligation.category}
            onChange={(event) => update("category", event.target.value)}
            disabled={disabled}
            className={inputClass}
          >
            {PLANNING_CATEGORIES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>

        <label className="block" htmlFor={fieldId("amount")}>
          <span className="mb-1 block text-sm font-bold text-slate-700">
            Amount {known ? "" : "(optional)"}
          </span>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-3 text-sm font-bold text-slate-400">$</span>
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
          <span className="mb-1 block text-sm font-bold text-slate-700">
            Due date {known ? "" : "(optional)"}
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

        <label className="block md:col-span-2" htmlFor={fieldId("note")}>
          <span className="mb-1 block text-sm font-bold text-slate-700">Note (optional)</span>
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
    </fieldset>
  );
};

export default ObligationEditor;
