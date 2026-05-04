import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createLiability,
  deleteLiability,
  getLiabilities,
  getLiabilitySummary,
  updateLiability,
} from "../api/liabilities";
import Modal from "../components/Modal";
import Sidebar from "../components/Sidebar";

const liabilityTypes = [
  { value: "friend", label: "Friend" },
  { value: "credit_card", label: "Credit card" },
  { value: "loan", label: "Loan" },
  { value: "bill", label: "Bill" },
  { value: "other", label: "Other" },
];

const emptyForm = {
  creditorName: "",
  liabilityType: "friend",
  originalAmount: "",
  currentBalance: "",
  dueDate: "",
  minimumPayment: "",
  plannedMonthlyPayment: "",
  notes: "",
};

const emptySummary = {
  totalActiveDebt: 0,
  totalPaidDebt: 0,
  activeCount: 0,
  paidCount: 0,
  dueSoonCount: 0,
  dueSoonAmount: 0,
  monthlyDebtPressure: 0,
  highestBalanceLiability: null,
};

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) {
    return "No due date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No due date";
  }

  return date.toLocaleDateString();
};

const toDateInputValue = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
};

const getTypeLabel = (type) =>
  liabilityTypes.find((item) => item.value === type)?.label || "Other";

const getPaymentLabel = (liability) => {
  const plannedPayment = Number(liability.plannedMonthlyPayment || 0);
  const minimumPayment = Number(liability.minimumPayment || 0);

  if (plannedPayment > 0) {
    return `Planned: ${formatCurrency(plannedPayment)}`;
  }

  if (minimumPayment > 0) {
    return `Minimum: ${formatCurrency(minimumPayment)}`;
  }

  return "No payment set";
};

const Liabilities = () => {
  const [liabilities, setLiabilities] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLiability, setEditingLiability] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState("");

  const filters = useMemo(
    () => (statusFilter === "all" ? {} : { status: statusFilter }),
    [statusFilter]
  );

  const fetchDebtReality = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [liabilityData, summaryData] = await Promise.all([
        getLiabilities(filters),
        getLiabilitySummary(),
      ]);

      setLiabilities(Array.isArray(liabilityData) ? liabilityData : []);
      setSummary({ ...emptySummary, ...(summaryData || {}) });
    } catch (fetchError) {
      setError(
        fetchError.response?.data?.message || "Failed to load Debt Reality."
      );
      setLiabilities([]);
      setSummary(emptySummary);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchDebtReality();
  }, [fetchDebtReality]);

  const openCreateModal = () => {
    setEditingLiability(null);
    setFormData(emptyForm);
    setMessage(null);
    setModalOpen(true);
  };

  const openEditModal = (liability) => {
    setEditingLiability(liability);
    setFormData({
      creditorName: liability.creditorName || "",
      liabilityType: liability.liabilityType || "friend",
      originalAmount: String(liability.originalAmount ?? ""),
      currentBalance: String(liability.currentBalance ?? ""),
      dueDate: toDateInputValue(liability.dueDate),
      minimumPayment: String(liability.minimumPayment || ""),
      plannedMonthlyPayment: String(liability.plannedMonthlyPayment || ""),
      notes: liability.notes || "",
    });
    setMessage(null);
    setModalOpen(true);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage(null);

      if (editingLiability) {
        await updateLiability(editingLiability._id, formData);
        setMessage({ type: "success", text: "Debt updated." });
      } else {
        await createLiability(formData);
        setMessage({ type: "success", text: "Debt added." });
      }

      setModalOpen(false);
      setEditingLiability(null);
      setFormData(emptyForm);
      await fetchDebtReality();
    } catch (saveError) {
      setMessage({
        type: "error",
        text: saveError.response?.data?.message || "Failed to save debt.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (liability) => {
    try {
      setActionId(`paid-${liability._id}`);
      setMessage(null);
      await updateLiability(liability._id, {
        ...liability,
        status: "paid",
        currentBalance: 0,
      });
      setMessage({ type: "success", text: "Debt marked as paid." });
      await fetchDebtReality();
    } catch (actionError) {
      setMessage({
        type: "error",
        text: actionError.response?.data?.message || "Failed to mark debt paid.",
      });
    } finally {
      setActionId("");
    }
  };

  const handleDelete = async (liability) => {
    if (!window.confirm(`Delete ${liability.creditorName}? This cannot be undone.`)) {
      return;
    }

    try {
      setActionId(`delete-${liability._id}`);
      setMessage(null);
      await deleteLiability(liability._id);
      setMessage({ type: "success", text: "Debt deleted." });
      await fetchDebtReality();
    } catch (actionError) {
      setMessage({
        type: "error",
        text: actionError.response?.data?.message || "Failed to delete debt.",
      });
    } finally {
      setActionId("");
    }
  };

  const hasLiabilities = liabilities.length > 0;
  const insightText =
    summary.dueSoonCount > 0
      ? `You have ${summary.dueSoonCount} liability payment(s) due soon.`
      : Number(summary.monthlyDebtPressure || 0) > 0
      ? `Your current monthly debt pressure is ${formatCurrency(
          summary.monthlyDebtPressure
        )}.`
      : "No liabilities yet. Add debts, credit cards, or borrowed money to understand your monthly pressure.";

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Sidebar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10 lg:ml-72 lg:w-auto">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-indigo-600">
              Financial Life
            </p>
            <h1 className="text-3xl font-black text-slate-900 md:text-4xl">
              Debt Reality
            </h1>
            <p className="mt-2 text-slate-500">
              Track what you owe, what is due soon, and your monthly debt pressure.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 sm:w-auto"
          >
            Add Debt
          </button>
        </header>

        {(error || message?.text) && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
              message?.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {error || message.text}
          </div>
        )}

        <section className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Total Debt"
            value={formatCurrency(summary.totalActiveDebt)}
            tone="text-rose-600"
          />
          <SummaryCard
            label="Monthly Debt Pressure"
            value={formatCurrency(summary.monthlyDebtPressure)}
          />
          <SummaryCard
            label="Due Soon"
            value={`${summary.dueSoonCount} payment${
              summary.dueSoonCount === 1 ? "" : "s"
            }`}
            helper={formatCurrency(summary.dueSoonAmount)}
            tone={summary.dueSoonCount > 0 ? "text-amber-600" : "text-slate-900"}
          />
          <SummaryCard label="Active Debts" value={summary.activeCount} />
        </section>

        <section className="mb-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                Debt Reality Check
              </h2>
              <p className="mt-1 text-sm text-slate-500">{insightText}</p>
              {summary.highestBalanceLiability && (
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  Highest balance: {summary.highestBalanceLiability.creditorName} (
                  {formatCurrency(summary.highestBalanceLiability.currentBalance)})
                </p>
              )}
            </div>

            <div className="flex rounded-2xl bg-slate-100 p-1">
              {["all", "active", "paid"].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold capitalize transition ${
                    statusFilter === status
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4 md:px-6">
            <h2 className="text-xl font-black text-slate-900">What You Owe</h2>
            <p className="text-sm text-slate-500">
              Track personal debts, bills, credit cards, loans, and borrowed money.
            </p>
          </div>

          {loading ? (
            <EmptyState title="Loading Debt Reality..." />
          ) : !hasLiabilities ? (
            <EmptyState
              title="No debts yet."
              description="No liabilities yet. Add debts, credit cards, or borrowed money to understand your monthly pressure."
              actionLabel="Add Debt"
              onAction={openCreateModal}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {liabilities.map((liability) => (
                <DebtRow
                  key={liability._id}
                  liability={liability}
                  actionId={actionId}
                  onEdit={openEditModal}
                  onMarkPaid={handleMarkPaid}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>

        <Modal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingLiability(null);
            setMessage(null);
          }}
          title={editingLiability ? "Edit Debt" : "Add Debt"}
          description="Track a personal debt, bill, credit card, loan, or borrowed money."
        >
          <DebtForm
            formData={formData}
            saving={saving}
            editing={Boolean(editingLiability)}
            onChange={handleFormChange}
            onSubmit={handleSubmit}
          />
        </Modal>
      </main>
    </div>
  );
};

const DebtForm = ({ formData, saving, editing, onChange, onSubmit }) => (
  <form onSubmit={onSubmit} className="space-y-4">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField label="Creditor name">
        <input
          name="creditorName"
          value={formData.creditorName}
          onChange={onChange}
          required
          disabled={saving}
          className={inputClass}
          placeholder="Visa, Alex, Student loan"
        />
      </FormField>

      <FormField label="Debt type">
        <select
          name="liabilityType"
          value={formData.liabilityType}
          onChange={onChange}
          disabled={saving}
          className={inputClass}
        >
          {liabilityTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Original amount">
        <input
          name="originalAmount"
          type="number"
          min="0"
          step="0.01"
          value={formData.originalAmount}
          onChange={onChange}
          required
          disabled={saving}
          className={inputClass}
        />
      </FormField>

      <FormField label="Current balance">
        <input
          name="currentBalance"
          type="number"
          min="0"
          step="0.01"
          value={formData.currentBalance}
          onChange={onChange}
          required
          disabled={saving}
          className={inputClass}
        />
      </FormField>

      <FormField label="Due date">
        <input
          name="dueDate"
          type="date"
          value={formData.dueDate}
          onChange={onChange}
          disabled={saving}
          className={inputClass}
        />
      </FormField>

      <FormField label="Minimum payment">
        <input
          name="minimumPayment"
          type="number"
          min="0"
          step="0.01"
          value={formData.minimumPayment}
          onChange={onChange}
          disabled={saving}
          className={inputClass}
        />
      </FormField>

      <FormField label="Planned monthly payment">
        <input
          name="plannedMonthlyPayment"
          type="number"
          min="0"
          step="0.01"
          value={formData.plannedMonthlyPayment}
          onChange={onChange}
          disabled={saving}
          className={inputClass}
        />
      </FormField>
    </div>

    <FormField label="Notes">
      <textarea
        name="notes"
        value={formData.notes}
        onChange={onChange}
        disabled={saving}
        rows={3}
        className={inputClass}
        placeholder="Optional notes"
      />
    </FormField>

    <button
      type="submit"
      disabled={saving}
      className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300"
    >
      {saving ? "Saving..." : editing ? "Save Debt" : "Add Debt"}
    </button>
  </form>
);

const FormField = ({ label, children }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-bold text-slate-700">{label}</span>
    {children}
  </label>
);

const DebtRow = ({ liability, actionId, onEdit, onMarkPaid, onDelete }) => (
  <article className="px-5 py-5 md:px-6">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-words text-lg font-black text-slate-900">
            {liability.creditorName}
          </h3>
          <StatusPill status={liability.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {getTypeLabel(liability.liabilityType)} - Due {formatDate(liability.dueDate)}
        </p>
        {liability.notes && (
          <p className="mt-2 max-w-2xl break-words text-sm text-slate-500">
            {liability.notes}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[34rem]">
        <DebtMiniStat
          label="Current balance"
          value={formatCurrency(liability.currentBalance)}
          tone={liability.status === "paid" ? "text-emerald-600" : "text-rose-600"}
        />
        <DebtMiniStat label="Payment" value={getPaymentLabel(liability)} />
        <DebtMiniStat
          label="Original amount"
          value={formatCurrency(liability.originalAmount)}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
        <button
          type="button"
          onClick={() => onEdit(liability)}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
        >
          Edit
        </button>
        {liability.status !== "paid" && (
          <button
            type="button"
            onClick={() => onMarkPaid(liability)}
            disabled={Boolean(actionId)}
            className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:text-emerald-300"
          >
            {actionId === `paid-${liability._id}` ? "Updating..." : "Mark Paid"}
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(liability)}
          disabled={Boolean(actionId)}
          className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:text-rose-300"
        >
          {actionId === `delete-${liability._id}` ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  </article>
);

const SummaryCard = ({ label, value, helper, tone = "text-slate-900" }) => (
  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
    <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className={`break-words text-2xl font-black ${tone}`}>{value}</p>
    {helper && <p className="mt-1 text-sm font-semibold text-slate-500">{helper}</p>}
  </div>
);

const DebtMiniStat = ({ label, value, tone = "text-slate-900" }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
    <p className="text-xs font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className={`mt-1 break-words text-sm font-black ${tone}`}>{value}</p>
  </div>
);

const StatusPill = ({ status }) => (
  <span
    className={`rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-widest ${
      status === "paid"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-slate-100 text-slate-600"
    }`}
  >
    {status}
  </span>
);

const EmptyState = ({ title, description, actionLabel, onAction }) => (
  <div className="px-6 py-12 text-center">
    <p className="font-bold text-slate-700">{title}</p>
    {description && (
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">{description}</p>
    )}
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-5 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export default Liabilities;
