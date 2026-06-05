import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import api from "../api/axios";
import {
  archiveReceipt,
  getReceiptFile,
  getReceipts,
  updateReceipt,
  uploadReceipt,
} from "../api/receipts";

const EMPTY_UPLOAD_FORM = {
  vendor: "",
  amount: "",
  purchaseDate: "",
  category: "Other",
  notes: "",
  tags: "",
};

const EMPTY_FILTERS = {
  search: "",
  status: "",
  category: "",
  includeArchived: false,
  from: "",
  to: "",
};

const STATUS_OPTIONS = ["uploaded", "reviewed", "linked", "archived"];
const CATEGORY_OPTIONS = [
  "Other",
  "Groceries",
  "Food",
  "Fuel",
  "Travel",
  "Software",
  "Office",
  "Healthcare",
  "Rent",
  "Phone",
  "Internet",
];

const hasExpenseReceipt = (expense) =>
  Boolean(String(expense?.receiptUrl || expense?.receipt || "").trim());

const getMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
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

const buildReceiptPayload = (form) => ({
  vendor: form.vendor,
  amount: form.amount,
  purchaseDate: form.purchaseDate,
  category: form.category,
  notes: form.notes,
  tags: form.tags,
});

const getTodayDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getYesterdayDateString = () => {
  const d = new Date(Date.now() - 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
};

const DateQuickButtons = ({ name, onChange }) => {
  const setDate = (value) => onChange({ target: { name, value } });

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setDate(getTodayDateString())}
        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Today
      </button>
      <button
        type="button"
        onClick={() => setDate(getYesterdayDateString())}
        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Yesterday
      </button>
      <button
        type="button"
        onClick={() => setDate("")}
        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-slate-800"
      >
        Clear
      </button>
    </div>
  );
};

const MoneyReceipts = () => {
  const [receipts, setReceipts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openingReceiptId, setOpeningReceiptId] = useState("");
  const [editingReceiptId, setEditingReceiptId] = useState("");
  const [editForm, setEditForm] = useState(EMPTY_UPLOAD_FORM);
  const [uploadForm, setUploadForm] = useState(EMPTY_UPLOAD_FORM);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expenseCoverage, setExpenseCoverage] = useState({
    total: 0,
    withReceipts: 0,
    missing: 0,
  });

  const loadReceipts = useCallback(async (overrideFilters) => {
    try {
      setLoading(true);
      setError("");

      const f = overrideFilters || filters;

      const params = {
        ...(f.search ? { search: f.search } : {}),
        ...(f.status ? { status: f.status } : {}),
        ...(f.category ? { category: f.category } : {}),
        ...(f.from ? { from: f.from } : {}),
        ...(f.to ? { to: f.to } : {}),
        ...(f.includeArchived ? { includeArchived: true } : {}),
      };

      const data = await getReceipts(params);
      setReceipts(Array.isArray(data.receipts) ? data.receipts : []);
      setPagination(data.pagination || null);
    } catch (loadError) {
      setReceipts([]);
      setPagination(null);
      setError(getMessage(loadError, "Failed to load receipt inbox."));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadExpenseCoverage = useCallback(async () => {
    try {
      const { data } = await api.get("/expenses");
      const expenses = Array.isArray(data) ? data : [];
      const withReceipts = expenses.filter(hasExpenseReceipt).length;

      setExpenseCoverage({
        total: expenses.length,
        withReceipts,
        missing: expenses.length - withReceipts,
      });
    } catch {
      setExpenseCoverage({ total: 0, withReceipts: 0, missing: 0 });
    }
  }, []);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  useEffect(() => {
    loadExpenseCoverage();
  }, [loadExpenseCoverage]);

  const visibleCategories = useMemo(() => {
    const receiptCategories = receipts
      .map((receipt) => receipt.category)
      .filter(Boolean);

    return Array.from(new Set([...CATEGORY_OPTIONS, ...receiptCategories])).sort();
  }, [receipts]);

  const coveragePercent =
    expenseCoverage.total > 0
      ? Math.round((expenseCoverage.withReceipts / expenseCoverage.total) * 100)
      : 0;

  const resetUploadForm = () => {
    setUploadForm(EMPTY_UPLOAD_FORM);
    setSelectedFile(null);
    setFileInputKey((current) => current + 1);
  };

  const handleUploadChange = (event) => {
    const { name, value } = event.target;
    setUploadForm((current) => ({ ...current, [name]: value }));
  };

  const handleFilterChange = (event) => {
    const { name, value, checked, type } = event.target;
    setFilters((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedFile) {
      setError("Receipt file is required.");
      return;
    }

    const formData = new FormData();
    formData.append("receipt", selectedFile);
    Object.entries(buildReceiptPayload(uploadForm)).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        formData.append(key, value);
      }
    });

    try {
      setUploading(true);
      await uploadReceipt(formData);
      setSuccess("Receipt uploaded.");
      resetUploadForm();
      await loadReceipts();
    } catch (uploadError) {
      setError(getMessage(uploadError, "Failed to upload receipt."));
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (receipt) => {
    setError("");
    setSuccess("");
    setEditingReceiptId(receipt._id);
    setEditForm({
      vendor: receipt.vendor || "",
      amount: receipt.amount ?? "",
      purchaseDate: toDateInputValue(receipt.purchaseDate),
      category: receipt.category || "Other",
      notes: receipt.notes || "",
      tags: Array.isArray(receipt.tags) ? receipt.tags.join(", ") : "",
      status: receipt.status || "uploaded",
    });
  };

  const cancelEdit = () => {
    setEditingReceiptId("");
    setEditForm(EMPTY_UPLOAD_FORM);
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
  };

  const saveEdit = async (receiptId) => {
    try {
      setError("");
      setSuccess("");
      const payload = {
        ...buildReceiptPayload(editForm),
        status: editForm.status || "uploaded",
      };

      await updateReceipt(receiptId, payload);
      setSuccess("Receipt updated.");
      cancelEdit();
      await loadReceipts();
    } catch (updateError) {
      setError(getMessage(updateError, "Failed to update receipt."));
    }
  };

  const openReceiptFile = async (receipt) => {
    if (openingReceiptId) {
      return;
    }

    try {
      setError("");
      setOpeningReceiptId(receipt._id);
      const response = await getReceiptFile(receipt._id);
      const blob = new Blob([response.data], {
        type: response.headers?.["content-type"] || receipt.mimeType || "application/octet-stream",
      });
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
    } catch (fileError) {
      setError(getMessage(fileError, "Failed to open receipt file."));
    } finally {
      setOpeningReceiptId("");
    }
  };

  const handleArchive = async (receipt) => {
    const confirmed = window.confirm(
      "Archive this receipt? It will be hidden from the default inbox."
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccess("");
      await archiveReceipt(receipt._id);
      setSuccess("Receipt archived.");
      if (editingReceiptId === receipt._id) {
        cancelEdit();
      }
      await loadReceipts();
    } catch (archiveError) {
      setError(getMessage(archiveError, "Failed to archive receipt."));
    }
  };

  const hasActiveFilters =
    filters.search || filters.status || filters.category || filters.from || filters.to || filters.includeArchived;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10 lg:ml-72 lg:w-auto">
        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold text-indigo-600 dark:text-indigo-300">
            Money
          </p>
          <h1 className="text-3xl font-black text-slate-950 dark:text-white md:text-4xl">
            Receipt Inbox
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500 dark:text-slate-400">
            Upload, review, and organize receipts before linking them to expenses.
          </p>
        </header>

        {(error || success) && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-semibold ${
              error
                ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
                : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
            }`}
          >
            {error || success}
          </div>
        )}

        <section className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
          <SummaryCard label="Inbox Receipts" value={pagination?.total || receipts.length} />
          <SummaryCard
            label="Expense Coverage"
            value={`${coveragePercent}%`}
            tone="text-indigo-600 dark:text-indigo-300"
          />
          <SummaryCard
            label="With Expense Receipt"
            value={expenseCoverage.withReceipts}
            tone="text-emerald-600 dark:text-emerald-300"
          />
          <SummaryCard
            label="Missing Expense Receipt"
            value={expenseCoverage.missing}
            tone="text-rose-600 dark:text-rose-300"
          />
        </section>

        <FilterShortcuts filters={filters} onApply={(next) => { const merged = { ...filters, ...next }; setFilters(merged); loadReceipts(merged); }} />

        <section className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <UploadReceiptCard
            form={uploadForm}
            fileInputKey={fileInputKey}
            uploading={uploading}
            selectedFile={selectedFile}
            onChange={handleUploadChange}
            onFileChange={(file) => setSelectedFile(file)}
            onSubmit={handleUpload}
          />

          <FilterCard
            filters={filters}
            categories={visibleCategories}
            loading={loading}
            onChange={handleFilterChange}
            onRefresh={loadReceipts}
            onReset={() => setFilters(EMPTY_FILTERS)}
          />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800 md:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950 dark:text-white">
                  Receipt Documents
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Search, review, edit, and archive standalone receipts.
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                {pagination?.total || receipts.length} saved
              </p>
            </div>
          </div>

          <div className="p-5 md:p-6">
            {loading ? (
              <EmptyState title="Loading receipts..." text="Fetching your receipt inbox." />
            ) : receipts.length === 0 ? (
              <EmptyState
                title={
                  hasActiveFilters
                    ? "No receipts match your filters."
                    : "Upload your first receipt to start building your document inbox."
                }
                text={
                  hasActiveFilters
                    ? "Try clearing the search, status, category, or archived filter."
                    : "Receipts stay private and can be reviewed before linking to expenses."
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {receipts.map((receipt) => (
                  <ReceiptCard
                    key={receipt._id}
                    receipt={receipt}
                    isEditing={editingReceiptId === receipt._id}
                    editForm={editForm}
                    openingReceiptId={openingReceiptId}
                    categories={visibleCategories}
                    onOpenFile={openReceiptFile}
                    onStartEdit={startEdit}
                    onCancelEdit={cancelEdit}
                    onEditChange={handleEditChange}
                    onSaveEdit={saveEdit}
                    onArchive={handleArchive}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

const SummaryCard = ({ label, value, tone = "text-slate-950 dark:text-white" }) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
    <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
      {label}
    </p>
    <p className={`break-words text-2xl font-black ${tone}`}>{value}</p>
  </div>
);

const UploadReceiptCard = ({
  form,
  fileInputKey,
  uploading,
  selectedFile,
  onChange,
  onFileChange,
  onSubmit,
}) => (
  <form
    onSubmit={onSubmit}
    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 md:p-6"
  >
    <div className="mb-5">
      <h2 className="text-xl font-black text-slate-950 dark:text-white">
        Upload receipt
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Add a receipt file and optional metadata for later review.
      </p>
    </div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Receipt file
        </span>
        <input
          key={fileInputKey}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          onChange={(event) => onFileChange(event.target.files?.[0] || null)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:file:bg-slate-100 dark:file:text-slate-950"
        />
        {selectedFile && (
          <span className="mt-2 block text-xs font-semibold text-slate-500 dark:text-slate-400">
            Selected: {selectedFile.name}
          </span>
        )}
      </label>

      <TextInput label="Vendor" name="vendor" value={form.vendor} onChange={onChange} />
      <TextInput
        label="Amount"
        name="amount"
        type="number"
        step="0.01"
        min="0"
        value={form.amount}
        onChange={onChange}
      />
      <label>
        <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Purchase date
        </span>
        <input
          type="date"
          name="purchaseDate"
          value={form.purchaseDate}
          onChange={onChange}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <DateQuickButtons name="purchaseDate" onChange={onChange} />
      </label>
      <SelectInput
        label="Category"
        name="category"
        value={form.category}
        options={CATEGORY_OPTIONS}
        onChange={onChange}
      />
      <label>
        <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Tags
        </span>
        <input
          type="text"
          name="tags"
          value={form.tags}
          onChange={onChange}
          placeholder="Use tags like business, tax, groceries, work, travel."
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </label>
      <label className="sm:col-span-2">
        <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Notes
        </span>
        <textarea
          name="notes"
          value={form.notes}
          onChange={onChange}
          rows="3"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </label>
    </div>

    <button
      type="submit"
      disabled={uploading}
      className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
    >
      {uploading ? "Uploading..." : "Upload receipt"}
    </button>
  </form>
);

const shortcutButtonClass =
  "rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-bold transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

const shortcutActiveClass =
  "rounded-xl bg-slate-950 px-3.5 py-1.5 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-950";

const isFilterEmpty = (f) =>
  !f.search && !f.status && !f.category && !f.from && !f.to && !f.includeArchived;

const FilterShortcuts = ({ filters, onApply }) => {
  const { from, to } = getMonthRange();

  const shortcuts = [
    { label: "All", filter: EMPTY_FILTERS, active: isFilterEmpty(filters) },
    {
      label: "This month",
      filter: { from, to, includeArchived: false },
      active: filters.from === from && filters.to === to && !filters.includeArchived,
    },
    {
      label: "Missing details",
      filter: { status: "uploaded" },
      active: filters.status === "uploaded",
    },
    {
      label: "Reviewed",
      filter: { status: "reviewed" },
      active: filters.status === "reviewed",
    },
    {
      label: "Archived",
      filter: { includeArchived: true },
      active: filters.includeArchived,
    },
  ];

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {shortcuts.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => onApply(s.filter)}
          className={s.active ? shortcutActiveClass : shortcutButtonClass}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
};

const FilterCard = ({
  filters,
  categories,
  loading,
  onChange,
  onRefresh,
  onReset,
}) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 md:p-6">
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-xl font-black text-slate-950 dark:text-white">
          Search and filter
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Find receipts by vendor, notes, filename, tags, status, or category.
        </p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Refresh
      </button>
    </div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextInput
        label="Search"
        name="search"
        value={filters.search}
        placeholder="Vendor, notes, filename, tag"
        onChange={onChange}
      />
      <SelectInput
        label="Status"
        name="status"
        value={filters.status}
        options={["", ...STATUS_OPTIONS]}
        optionLabels={{ "": "All statuses" }}
        onChange={onChange}
      />
      <SelectInput
        label="Category"
        name="category"
        value={filters.category}
        options={["", ...categories]}
        optionLabels={{ "": "All categories" }}
        onChange={onChange}
      />
      <label className="flex min-h-[50px] items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700">
        <input
          type="checkbox"
          name="includeArchived"
          checked={filters.includeArchived}
          onChange={onChange}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600"
        />
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
          Include archived receipts
        </span>
      </label>
    </div>

    <button
      type="button"
      onClick={onReset}
      className="mt-5 rounded-xl px-4 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
    >
      Clear filters
    </button>
  </div>
);

const ReceiptCard = ({
  receipt,
  isEditing,
  editForm,
  openingReceiptId,
  categories,
  onOpenFile,
  onStartEdit,
  onCancelEdit,
  onEditChange,
  onSaveEdit,
  onArchive,
}) => {
  const isArchived = receipt.status === "archived";
  const displayName = receipt.vendor || receipt.originalFilename || "Unknown vendor";

  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="truncate text-base font-black text-slate-950 dark:text-white">
            {displayName}
          </h3>
          <p className="text-lg font-black text-slate-950 dark:text-white">
            {formatCurrency(receipt.amount) || ""}
          </p>
          <StatusBadge status={receipt.status} />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenFile(receipt)}
            disabled={openingReceiptId === receipt._id || isArchived}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
          >
            {openingReceiptId === receipt._id ? "Opening..." : "View file"}
          </button>
          <button
            type="button"
            onClick={() => onStartEdit(receipt)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Edit
          </button>
          {!isArchived && (
            <button
              type="button"
              onClick={() => onArchive(receipt)}
              className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900/70 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              Archive
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {receipt.purchaseDate ? formatDate(receipt.purchaseDate) : "No date"}
        {receipt.category ? ` · ${receipt.category}` : ""}
        {receipt.uploadedAt ? ` · ${formatDate(receipt.uploadedAt)}` : ""}
      </p>

      {Array.isArray(receipt.tags) && receipt.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {receipt.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {receipt.notes && (
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          {receipt.notes}
        </p>
      )}

      {isEditing && (
        <EditReceiptPanel
          receiptId={receipt._id}
          form={editForm}
          categories={categories}
          onChange={onEditChange}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
        />
      )}
    </article>
  );
};

const EditReceiptPanel = ({ receiptId, form, categories, onChange, onSave, onCancel }) => (
  <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <h4 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
      Edit receipt metadata
    </h4>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <TextInput label="Vendor" name="vendor" value={form.vendor} onChange={onChange} />
      <TextInput
        label="Amount"
        name="amount"
        type="number"
        step="0.01"
        min="0"
        value={form.amount}
        onChange={onChange}
      />
      <label>
        <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Purchase date
        </span>
        <input
          type="date"
          name="purchaseDate"
          value={form.purchaseDate}
          onChange={onChange}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <DateQuickButtons name="purchaseDate" onChange={onChange} />
      </label>
    </div>
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SelectInput
        label="Category"
        name="category"
        value={form.category}
        options={categories}
        onChange={onChange}
      />
      <SelectInput
        label="Status"
        name="status"
        value={form.status}
        options={STATUS_OPTIONS}
        onChange={onChange}
      />
      <label>
        <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Tags
        </span>
        <input
          type="text"
          name="tags"
          value={form.tags}
          onChange={onChange}
          placeholder="Use tags like business, tax, groceries, work, travel."
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </label>
      <label className="sm:col-span-2 lg:col-span-3">
        <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Notes
        </span>
        <textarea
          name="notes"
          value={form.notes}
          onChange={onChange}
          rows="3"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </label>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSave(receiptId)}
        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
      >
        Save changes
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Cancel
      </button>
    </div>
  </div>
);

const TextInput = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  step,
  min,
}) => (
  <label>
    <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
      {label}
    </span>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      step={step}
      min={min}
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
    />
  </label>
);

const SelectInput = ({ label, name, value, options, optionLabels = {}, onChange }) => (
  <label>
    <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
      {label}
    </span>
    <select
      name={name}
      value={value}
      onChange={onChange}
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {optionLabels[option] || option}
        </option>
      ))}
    </select>
  </label>
);

const StatusBadge = ({ status }) => {
  const styles = {
    uploaded:
      "bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-200 dark:ring-indigo-900/70",
    reviewed:
      "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900/70",
    linked:
      "bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900/70",
    archived:
      "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest ring-1 ${
        styles[status] || styles.uploaded
      }`}
    >
      {status || "uploaded"}
    </span>
  );
};

const MetaItem = ({ label, value }) => (
  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
    <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
      {label}
    </p>
    <p className="mt-1 break-words text-sm font-black text-slate-900 dark:text-slate-100">
      {value}
    </p>
  </div>
);

const EmptyState = ({ title, text }) => (
  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center dark:border-slate-800 dark:bg-slate-950/60">
    <p className="text-lg font-black text-slate-900 dark:text-white">{title}</p>
    <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
      {text}
    </p>
  </div>
);

export default MoneyReceipts;
