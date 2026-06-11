import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/axios";
import DocumentUploadField from "./DocumentUploadField";

const expenseCategories = [
  "Rent",
  "Food",
  "Groceries",
  "Utilities",
  "Entertainment",
  "Transport",
  "Fuel",
  "Healthcare",
  "Shopping",
  "Phone & Internet",
  "Software & SaaS",
  "Office Supplies",
  "Equipment",
  "Education",
  "Marketing",
  "Travel",
  "Meals",
  "Insurance",
  "Bank Fees",
  "Taxes & Licenses",
  "Professional Services",
  "Contractors",
  "Home Office",
  "Client Gifts",
  "Other",
];

const incomeCategories = [
  "Salary",
  "Freelance",
  "Contract",
  "Marketplace",
  "Business",
  "Gift",
  "Investment",
  "Refund",
  "Other",
];

const expenseTypeOptions = [
  { value: "personal", label: "Personal" },
  { value: "business", label: "Business" },
  { value: "mixed", label: "Mixed use" },
];

const taxCategories = [
  "Advertising & Marketing",
  "Bank Fees & Interest",
  "Cell Phone & Internet",
  "Continuing Education",
  "Contractors",
  "Equipment & Assets",
  "Home Office",
  "Insurance",
  "Meals",
  "Office Supplies",
  "Professional Fees",
  "Rent & Workspace",
  "Software & SaaS",
  "Taxes & Licenses",
  "Travel",
  "Utilities",
  "Vehicle",
  "Other Deductible Expense",
];

const transactionTypeOptions = [
  {
    value: "income",
    label: "Income",
    helper: "Money received",
    selectedClasses: "border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-100",
    iconClasses: "bg-emerald-600 text-white",
  },
  {
    value: "expense",
    label: "Expense",
    helper: "Money spent",
    selectedClasses: "border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-100",
    iconClasses: "bg-rose-600 text-white",
  },
];

const padNumber = (value) => String(value).padStart(2, "0");

const formatDateInput = (dateValue) => {
  const date = new Date(dateValue);

  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(
    date.getDate()
  )}`;
};

const getTodayString = () => formatDateInput(new Date());

const getYesterdayString = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatDateInput(yesterday);
};

const getMinAllowedDate = () => {
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 6);
  return formatDateInput(minDate);
};

const getMaxAllowedDate = () => {
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  return formatDateInput(maxDate);
};

const AddTransaction = ({
  onTransactionAdded,
  editingTransaction,
  onCancelEdit,
  onStatusMessage,
}) => {
  const [searchParams] = useSearchParams();
  const initialType = ["income", "expense"].includes(searchParams.get("type"))
    ? searchParams.get("type")
    : "expense";
  const [type, setType] = useState(initialType);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [openingCurrentReceipt, setOpeningCurrentReceipt] = useState(false);
  const [formStatus, setFormStatus] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const getInitialFormData = (transactionType = "expense") => ({
    amount: "",
    source: "",
    recipient: "",
    category: transactionType === "income" ? "Salary" : "Other",
    date: getTodayString(),
    notes: "",
    expenseType: "personal",
    deductible: false,
    deductiblePercent: "100",
    taxCategory: "",
  });

  const [formData, setFormData] = useState(getInitialFormData(initialType));
  const [showDetails, setShowDetails] = useState(false);

  const minAllowedDate = getMinAllowedDate();
  const maxAllowedDate = getMaxAllowedDate();
  const isEditing = !!editingTransaction;
  const hasExistingReceipt =
    isEditing && type === "expense" && Boolean(editingTransaction?.receiptUrl);

  const resetFileInput = () => {
    setFile(null);
    setFileInputKey((current) => current + 1);
  };

  const resetForm = (nextType = type, options = {}) => {
    const { clearStatus = true } = options;
    setFormData(getInitialFormData(nextType));
    setShowDetails(false);
    if (clearStatus) {
      setFormStatus(null);
    }
    resetFileInput();
  };

  const switchType = (newType) => {
    if (isEditing) return;
    setType(newType);
    resetForm(newType);
  };

  useEffect(() => {
    if (editingTransaction) {
      const isIncome = !!editingTransaction.source;
      const nextType = isIncome ? "income" : "expense";

      setType(nextType);
      setFormData({
        amount: editingTransaction.amount || "",
        source: editingTransaction.source || "",
        recipient: editingTransaction.recipient || "",
        category:
          editingTransaction.category ||
          (nextType === "income" ? "Salary" : "Other"),
        date: editingTransaction.date
          ? formatDateInput(editingTransaction.date)
          : getTodayString(),
        notes: editingTransaction.notes || "",
        expenseType: editingTransaction.expenseType || "personal",
        deductible: Boolean(editingTransaction.deductible),
        deductiblePercent: editingTransaction.deductible
          ? String(
              editingTransaction.deductiblePercent ||
                (editingTransaction.expenseType === "mixed" ? 50 : 100)
            )
          : "0",
        taxCategory: editingTransaction.taxCategory || "",
      });
      setShowDetails(
        Boolean(
          editingTransaction.notes ||
            editingTransaction.receiptUrl ||
            editingTransaction.deductible ||
            editingTransaction.taxCategory ||
            (nextType === "expense" &&
              editingTransaction.expenseType &&
              editingTransaction.expenseType !== "personal") ||
            (nextType === "expense" &&
              editingTransaction.category &&
              editingTransaction.category !== "Other") ||
            (nextType === "income" &&
              editingTransaction.category &&
              editingTransaction.category !== "Salary")
        )
      );

      resetFileInput();
    } else {
      const nextType = ["income", "expense"].includes(searchParams.get("type"))
        ? searchParams.get("type")
        : type;

      setType(nextType);
      resetForm(nextType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTransaction]);

  const validateDate = (selectedDate) => {
    if (!selectedDate) return "Date is required";
    if (selectedDate < minAllowedDate) {
      return "You can keep records up to 6 years in the past.";
    }
    if (selectedDate > maxAllowedDate) {
      return "You can only plan transactions up to 1 year ahead.";
    }
    return "";
  };

  const handleChange = (e) => {
    const { name, value, type: inputType, checked } = e.target;

    if (formStatus) {
      setFormStatus(null);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: inputType === "checkbox" ? checked : value,
    }));
  };

  const handleExpenseTypeChange = (nextExpenseType) => {
    setFormData((prev) => {
      if (nextExpenseType === "personal") {
        return {
          ...prev,
          expenseType: nextExpenseType,
          deductible: false,
          deductiblePercent: "100",
          taxCategory: "",
        };
      }

      return {
        ...prev,
        expenseType: nextExpenseType,
        deductiblePercent:
          prev.deductiblePercent ||
          (nextExpenseType === "mixed" ? "50" : "100"),
      };
    });
  };

  const handleDeductibleToggle = (checked) => {
    setFormData((prev) => ({
      ...prev,
      deductible: checked,
      deductiblePercent: checked
        ? prev.deductiblePercent || (prev.expenseType === "mixed" ? "50" : "100")
        : "0",
      taxCategory: checked ? prev.taxCategory : "",
    }));
  };

  const setQuickDate = (value) => {
    setFormData((prev) => ({
      ...prev,
      date: value,
    }));
  };

  const handleCancelEdit = () => {
    resetForm("expense");
    setType("expense");
    if (onCancelEdit) onCancelEdit();
  };

  const handleViewCurrentReceipt = async () => {
    if (!editingTransaction?._id || openingCurrentReceipt) {
      return;
    }

    try {
      setOpeningCurrentReceipt(true);
      const response = await api.get(`/receipts/${editingTransaction._id}`, {
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(response.data);
      const receiptWindow = window.open(blobUrl, "_blank", "noopener,noreferrer");
      if (receiptWindow && typeof receiptWindow.addEventListener === "function") {
        try {
          receiptWindow.addEventListener(
            "load",
            () => window.URL.revokeObjectURL(blobUrl),
            { once: true }
          );
        } catch {
          window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
        }
      } else {
        window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
      }
    } catch (error) {
      console.error("Receipt fetch error:", error);
      const message =
        error?.response?.data?.message || "Failed to open receipt.";
      setFormStatus({ type: "error", message });
      onStatusMessage?.("error", message);
    } finally {
      setOpeningCurrentReceipt(false);
    }
  };

  const buildExpenseFormData = () => {
    const data = new FormData();
    const trimmedRecipient = formData.recipient.trim();

    data.append("amount", formData.amount);
    data.append("recipient", trimmedRecipient);
    data.append("category", formData.category);
    data.append("notes", formData.notes);
    data.append("date", formData.date);
    data.append("expenseType", formData.expenseType);
    data.append("deductible", String(formData.deductible));
    data.append(
      "deductiblePercent",
      formData.deductible
        ? formData.deductiblePercent ||
            (formData.expenseType === "mixed" ? "50" : "100")
        : "0"
    );
    data.append(
      "taxCategory",
      formData.expenseType === "personal" ? "" : formData.taxCategory
    );

    if (file) {
      data.append("receipt", file);
    }

    return data;
  };

  const nameField = type === "income" ? "source" : "recipient";
  const namePlaceholder = type === "income" ? "Source" : "Vendor / Payee";
  const detectedReceiptType =
    file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf")
      ? "PDF"
      : file?.type?.startsWith("image/") || /\.(jpe?g|png)$/i.test(file?.name || "")
      ? "Image"
      : "";
  const saveLabel = submitting
    ? isEditing
      ? "Updating..."
      : "Saving..."
    : isEditing
    ? `Update ${type}`
    : `Save ${type}`;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const dateError = validateDate(formData.date);
    if (dateError) {
      setFormStatus({ type: "error", message: dateError });
      return;
    }

    try {
      setSubmitting(true);
      setFormStatus(null);

      if (type === "expense") {
        if (!formData.amount || !formData.recipient.trim() || !formData.category) {
          setFormStatus({
            type: "error",
            message: "Please fill amount, vendor/payee, and category.",
          });
          return;
        }

        if (formData.deductible && !formData.taxCategory) {
          setFormStatus({
            type: "error",
            message: "Please select a tax category for deductible expenses.",
          });
          return;
        }

        if (
          formData.deductible &&
          (!formData.deductiblePercent ||
            Number(formData.deductiblePercent) <= 0 ||
            Number(formData.deductiblePercent) > 100)
        ) {
          setFormStatus({
            type: "error",
            message: "Deductible percent must be between 1 and 100.",
          });
          return;
        }

        const data = buildExpenseFormData();

        if (isEditing) {
          await api.put(`/expenses/${editingTransaction._id}`, data);
        } else {
          await api.post("/expenses", data);
        }
      } else {
        if (!formData.amount || !formData.source || !formData.category) {
          setFormStatus({
            type: "error",
            message: "Please fill amount, source, and category.",
          });
          return;
        }

        const payload = {
          amount: formData.amount,
          source: formData.source,
          category: formData.category,
          notes: formData.notes,
          date: formData.date,
        };

        if (isEditing) {
          await api.put(`/income/${editingTransaction._id}`, payload);
        } else {
          await api.post("/income", payload);
        }
      }

      const successMessage = isEditing
        ? `${type === "income" ? "Income" : "Expense"} updated successfully.`
        : `${type === "income" ? "Income" : "Expense"} saved successfully.`;

      resetForm(type, { clearStatus: false });
      setShowDetails(false);
      setFormStatus({ type: "success", message: successMessage });
      onStatusMessage?.("success", successMessage);

      if (isEditing && onCancelEdit) {
        onCancelEdit();
      }

      if (onTransactionAdded) {
        await onTransactionAdded();
      }
    } catch (error) {
      console.error("Transaction save error:", error);
      const message =
        error?.response?.data?.message || "Error saving transaction.";
      setFormStatus({ type: "error", message });
      onStatusMessage?.("error", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white">
            {isEditing ? "Edit Transaction" : "Add Transaction"}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Add the basics now. Details can wait.
          </p>
        </div>

        {onCancelEdit && (
          <button
            type="button"
            onClick={handleCancelEdit}
            className="text-sm font-semibold text-slate-600 hover:underline dark:text-slate-300"
          >
            {isEditing ? "Cancel" : "Close"}
          </button>
        )}
      </div>

      <div className="mb-4">
        <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
          Transaction Type
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {transactionTypeOptions.map((option) => {
            const selected = type === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => switchType(option.value)}
                disabled={isEditing}
                aria-pressed={selected}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                  selected
                    ? option.selectedClasses
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                } ${isEditing ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                    selected
                      ? option.iconClasses
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {option.value === "income" ? "+" : "-"}
                </span>
                <span>
                  <span className="block font-black">{option.label}</span>
                  <span className="text-sm font-medium opacity-75">
                    {option.helper}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {formStatus?.message && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
            formStatus.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200"
          }`}
        >
          {formStatus.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <input
            type="number"
            name="amount"
            placeholder="Amount"
            required
            min="0"
            step="0.01"
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
            value={formData.amount}
            onChange={handleChange}
          />

          <input
            type="text"
            name={nameField}
            placeholder={namePlaceholder}
            required
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
            value={formData[nameField]}
            onChange={handleChange}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <input
            type="date"
            name="date"
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            value={formData.date}
            min={minAllowedDate}
            max={maxAllowedDate}
            onChange={handleChange}
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setQuickDate(getTodayString())}
              className="rounded-full bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setQuickDate(getYesterdayString())}
              className="rounded-full bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800"
            >
              Yesterday
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails((current) => !current)}
          className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
          aria-expanded={showDetails}
        >
          {showDetails ? "Hide details" : "Add details"}
        </button>

        {showDetails && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <select
                name="category"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={formData.category}
                onChange={handleChange}
              >
                {(type === "income" ? incomeCategories : expenseCategories).map(
                  (category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  )
                )}
              </select>

              {type === "expense" && (
                <>
                  <select
                    name="expenseType"
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    value={formData.expenseType}
                    onChange={(e) => handleExpenseTypeChange(e.target.value)}
                  >
                    {expenseTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 md:col-span-2">
                    <input
                      type="checkbox"
                      checked={formData.deductible}
                      disabled={formData.expenseType === "personal"}
                      onChange={(e) => handleDeductibleToggle(e.target.checked)}
                      className="mt-1"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      <span className="block font-semibold text-slate-900 dark:text-white">
                        Include in Tax Pack
                      </span>
                      Track deductible amounts and build an export-ready freelance
                      or side-hustle record.
                    </span>
                  </label>

                  {formData.deductible && (
                    <>
                      <select
                        name="taxCategory"
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        value={formData.taxCategory}
                        onChange={handleChange}
                      >
                        <option value="">Select tax category</option>
                        {taxCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        name="deductiblePercent"
                        min="0"
                        max="100"
                        step="1"
                        placeholder="Deductible %"
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        value={formData.deductiblePercent}
                        onChange={handleChange}
                      />
                    </>
                  )}

                  <div className="md:col-span-2">
                    <DocumentUploadField
                      label="Receipt file"
                      helperText="Attach a receipt image or PDF if you have one."
                      supportedTypes={["JPG", "PNG", "PDF"]}
                      accept="image/*,.pdf"
                      selectedFile={file}
                      onFileChange={setFile}
                      detectedType={detectedReceiptType}
                      inputKey={fileInputKey}
                      trustText="Receipt files are stored with this expense record."
                    />

                    {hasExistingReceipt && !file && (
                      <button
                        type="button"
                        onClick={handleViewCurrentReceipt}
                        disabled={openingCurrentReceipt}
                        className="mt-1 inline-block text-xs font-semibold text-indigo-600 hover:underline disabled:text-slate-400 disabled:no-underline dark:text-indigo-300"
                      >
                        {openingCurrentReceipt ? "Opening..." : "Open current receipt"}
                      </button>
                    )}

                    {isEditing && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Choose a new file only if you want to replace the current
                        receipt.
                      </p>
                    )}
                    {!isEditing && formData.deductible && !file && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        Add a receipt now to make this expense export-ready for Tax
                        Pack.
                      </p>
                    )}
                  </div>
                </>
              )}

              <textarea
                name="notes"
                placeholder="Notes (optional)"
                rows="4"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 md:col-span-2"
                value={formData.notes}
                onChange={handleChange}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:bg-blue-400"
        >
          {saveLabel}
        </button>
      </form>
    </div>
  );
};

export default AddTransaction;
