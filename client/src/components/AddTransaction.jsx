import { useState, useRef, useEffect } from "react";
import api from "../api/axios";

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
  const [type, setType] = useState("expense");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [openingCurrentReceipt, setOpeningCurrentReceipt] = useState(false);
  const [formStatus, setFormStatus] = useState(null);
  const fileInputRef = useRef(null);

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

  const [formData, setFormData] = useState(getInitialFormData("expense"));

  const minAllowedDate = getMinAllowedDate();
  const maxAllowedDate = getMaxAllowedDate();
  const isEditing = !!editingTransaction;
  const hasExistingReceipt =
    isEditing && type === "expense" && Boolean(editingTransaction?.receiptUrl);

  const resetFileInput = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetForm = (nextType = type, options = {}) => {
    const { clearStatus = true } = options;
    setFormData(getInitialFormData(nextType));
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

      resetFileInput();
    } else {
      resetForm(type);
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
    <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-xl font-bold">
          {isEditing ? "Edit Transaction" : "Add New Transaction"}
        </h3>

        {isEditing && (
          <button
            type="button"
            onClick={handleCancelEdit}
            className="text-sm font-semibold text-slate-600 hover:underline"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="flex gap-3 mb-4">
        <button
          type="button"
          onClick={() => switchType("income")}
          disabled={isEditing}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            type === "income"
              ? "bg-green-600 text-white"
              : "bg-gray-200 text-gray-800"
          } ${isEditing ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          Income
        </button>

        <button
          type="button"
          onClick={() => switchType("expense")}
          disabled={isEditing}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            type === "expense"
              ? "bg-red-600 text-white"
              : "bg-gray-200 text-gray-800"
          } ${isEditing ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          Expense
        </button>
      </div>

      {formStatus?.message && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
            formStatus.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {formStatus.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="number"
          name="amount"
          placeholder="Amount"
          required
          min="0"
          step="0.01"
          className="border p-2 rounded-lg"
          value={formData.amount}
          onChange={handleChange}
        />

        <div className="space-y-2">
          <input
            type="date"
            name="date"
            className="border p-2 rounded-lg w-full"
            value={formData.date}
            min={minAllowedDate}
            max={maxAllowedDate}
            onChange={handleChange}
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setQuickDate(getTodayString())}
              className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setQuickDate(getYesterdayString())}
              className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200"
            >
              Yesterday
            </button>
          </div>
        </div>

        {type === "income" ? (
          <>
            <input
              type="text"
              name="source"
              placeholder="Source"
              required
              className="border p-2 rounded-lg"
              value={formData.source}
              onChange={handleChange}
            />

            <select
              name="category"
              className="border p-2 rounded-lg"
              value={formData.category}
              onChange={handleChange}
            >
              {incomeCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <input
              type="text"
              name="recipient"
              placeholder="Vendor / Payee"
              required
              className="border p-2 rounded-lg"
              value={formData.recipient}
              onChange={handleChange}
            />

            <select
              name="category"
              className="border p-2 rounded-lg"
              value={formData.category}
              onChange={handleChange}
            >
              {expenseCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              name="expenseType"
              className="border p-2 rounded-lg"
              value={formData.expenseType}
              onChange={(e) => handleExpenseTypeChange(e.target.value)}
            >
              {expenseTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label className="md:col-span-2 flex items-start gap-3 border border-slate-200 rounded-lg p-3">
              <input
                type="checkbox"
                checked={formData.deductible}
                disabled={formData.expenseType === "personal"}
                onChange={(e) => handleDeductibleToggle(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-slate-700">
                <span className="block font-semibold text-slate-900">
                  Include in Tax Pack
                </span>
                Track deductible amounts and build an export-ready freelance or
                side-hustle record.
              </span>
            </label>

            {formData.expenseType !== "personal" && (
              <>
                <select
                  name="taxCategory"
                  className="border p-2 rounded-lg"
                  value={formData.taxCategory}
                  onChange={handleChange}
                >
                  <option value="">
                    {formData.deductible
                      ? "Select tax category"
                      : "Optional tax category"}
                  </option>
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
                  disabled={!formData.deductible}
                  className="border p-2 rounded-lg disabled:bg-slate-100 disabled:text-slate-400"
                  value={formData.deductible ? formData.deductiblePercent : "0"}
                  onChange={handleChange}
                />
              </>
            )}
          </>
        )}

        {type === "expense" && (
          <div className="md:col-span-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,.pdf"
              className="border p-2 rounded-lg w-full"
              onChange={(e) => setFile(e.target.files[0] || null)}
            />

            {file && (
              <p className="text-xs text-slate-600 mt-1">
                Selected receipt: <span className="font-semibold">{file.name}</span>
              </p>
            )}

            {hasExistingReceipt && !file && (
              <button
                type="button"
                onClick={handleViewCurrentReceipt}
                disabled={openingCurrentReceipt}
                className="inline-block mt-1 text-xs font-semibold text-indigo-600 hover:underline disabled:text-slate-400 disabled:no-underline"
              >
                {openingCurrentReceipt ? "Opening..." : "Open current receipt"}
              </button>
            )}

            {isEditing && (
              <p className="text-xs text-slate-500 mt-1">
                Choose a new file only if you want to replace the current receipt.
              </p>
            )}
            {!isEditing && formData.deductible && !file && (
              <p className="text-xs text-amber-600 mt-1">
                Add a receipt now to make this expense export-ready for Tax Pack.
              </p>
            )}
          </div>
        )}

        <textarea
          name="notes"
          placeholder="Notes (optional)"
          rows="4"
          className="border p-2 rounded-lg md:col-span-2"
          value={formData.notes}
          onChange={handleChange}
        />

        <button
          type="submit"
          disabled={submitting}
          className="md:col-span-2 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
        >
          {submitting
            ? isEditing
              ? "Updating..."
              : "Saving..."
            : isEditing
            ? `Update ${type}`
            : `Save ${type}`}
        </button>
      </form>
    </div>
  );
};

export default AddTransaction;
