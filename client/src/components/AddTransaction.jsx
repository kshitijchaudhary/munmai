import { useState, useRef, useEffect } from "react";
import api from "../api/axios";

const expenseCategories = [
  "Rent",
  "Food",
  "Utilities",
  "Entertainment",
  "Transport",
  "Healthcare",
  "Shopping",
  "Other",
];

const incomeCategories = [
  "Salary",
  "Freelance",
  "Business",
  "Gift",
  "Investment",
  "Other",
];

const formatDateInput = (dateValue) => {
  const date = new Date(dateValue);
  return date.toISOString().split("T")[0];
};

const getTodayString = () => formatDateInput(new Date());

const getTomorrowString = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDateInput(tomorrow);
};

const getMinAllowedDate = () => {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 7);
  return formatDateInput(minDate);
};

const AddTransaction = ({
  onTransactionAdded,
  editingTransaction,
  onCancelEdit,
}) => {
  const [type, setType] = useState("expense");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const getInitialFormData = (transactionType = "expense") => ({
    amount: "",
    source: "",
    recipient: "",
    category: transactionType === "income" ? "Salary" : "Other",
    date: getTodayString(),
    notes: "",
  });

  const [formData, setFormData] = useState(getInitialFormData("expense"));

  const minAllowedDate = getMinAllowedDate();
  const maxAllowedDate = getTomorrowString();

  const resetFileInput = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetForm = (nextType = type) => {
    setFormData(getInitialFormData(nextType));
    resetFileInput();
  };

  const switchType = (newType) => {
    if (editingTransaction) return;
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
      return "You can only add or edit transactions up to 7 days in the past.";
    }
    if (selectedDate > maxAllowedDate) {
      return "You can only select today or tomorrow.";
    }
    return "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    const dateError = validateDate(formData.date);
    if (dateError) {
      alert(dateError);
      return;
    }

    try {
      setSubmitting(true);

      const isEditing = !!editingTransaction;

      if (type === "expense") {
        if (!formData.amount || !formData.recipient || !formData.category) {
          alert("Please fill amount, recipient, and category.");
          return;
        }

        const data = new FormData();
        data.append("amount", formData.amount);
        data.append("recipient", formData.recipient);
        data.append("category", formData.category);
        data.append("notes", formData.notes);
        data.append("date", formData.date);

        if (file) {
          data.append("receipt", file);
        }

        if (isEditing) {
          await api.put(`/expenses/${editingTransaction._id}`, data, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });
        } else {
          await api.post("/expenses", data, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });
        }
      } else {
        if (!formData.amount || !formData.source || !formData.category) {
          alert("Please fill amount, source, and category.");
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

      alert(
        isEditing
          ? `${type === "income" ? "Income" : "Expense"} updated successfully`
          : `${type === "income" ? "Income" : "Expense"} saved successfully`
      );

      resetForm(type);

      if (editingTransaction && onCancelEdit) {
        onCancelEdit();
      }

      if (onTransactionAdded) {
        onTransactionAdded();
      }
    } catch (error) {
      console.error("Transaction save error:", error);
      alert(error?.response?.data?.message || "Error saving transaction");
    } finally {
      setSubmitting(false);
    }
  };

  const isEditing = !!editingTransaction;

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
              onClick={() => setQuickDate(getTomorrowString())}
              className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200"
            >
              Tomorrow
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
              placeholder="Recipient / Vendor"
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
            {isEditing && (
              <p className="text-xs text-slate-500 mt-1">
                Choose a new file only if you want to replace the current receipt.
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