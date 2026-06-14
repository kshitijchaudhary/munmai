import { useState } from "react";
import { uploadReceipt } from "../api/receipts";
import DocumentUploadField from "./DocumentUploadField";
import Modal from "./Modal";

const EMPTY_UPLOAD_FORM = {
  vendor: "",
  amount: "",
  purchaseDate: "",
  category: "Other",
  notes: "",
  tags: "",
};

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

const getMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const buildReceiptPayload = (form) => ({
  vendor: form.vendor,
  amount: form.amount,
  purchaseDate: form.purchaseDate,
  category: form.category,
  notes: form.notes,
  tags: form.tags,
});

const getDetectedFileType = (file) => {
  if (!file) return "";

  const mimeType = String(file.type || "").toLowerCase();
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "image/jpeg") return "JPG";
  if (mimeType === "image/png") return "PNG";

  const name = String(file.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return "PDF";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "JPG";
  if (name.endsWith(".png")) return "PNG";

  return "";
};

const getTodayDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getYesterdayDateString = () => {
  const d = new Date(Date.now() - 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const ReceiptUploadModal = ({ isOpen, onClose, onUploaded }) => {
  const [form, setForm] = useState(EMPTY_UPLOAD_FORM);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) {
    return null;
  }

  const resetForm = () => {
    setForm(EMPTY_UPLOAD_FORM);
    setSelectedFile(null);
    setFileInputKey((current) => current + 1);
    setDetailsOpen(false);
  };

  const handleClose = () => {
    if (uploading) {
      return;
    }

    setError("");
    resetForm();
    onClose?.();
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!selectedFile) {
      setError("Receipt file is required.");
      return;
    }

    const formData = new FormData();
    formData.append("receipt", selectedFile);
    Object.entries(buildReceiptPayload(form)).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        formData.append(key, value);
      }
    });

    try {
      setUploading(true);
      await uploadReceipt(formData);
      resetForm();
      onClose?.();
      await onUploaded?.();
    } catch (uploadError) {
      setError(getMessage(uploadError, "Failed to upload receipt."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Upload receipt"
      description="Add a receipt file and optional metadata for later review."
    >
      {error && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <DocumentUploadField
          label="Receipt file"
          helperText="Upload a receipt image or PDF for your records."
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          selectedFile={selectedFile}
          onFileChange={setSelectedFile}
          supportedTypes={["JPG", "PNG", "PDF"]}
          detectedType={getDetectedFileType(selectedFile)}
          inputKey={fileInputKey}
          trustText="Files are stored privately and opened through protected access."
        />

        <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
          Free receipt uploads are limited to 3 per 24 hours and 15 per week.
        </p>

        <button
          type="button"
          onClick={() => setDetailsOpen((current) => !current)}
          className="mt-4 rounded-xl px-1 py-2 text-sm font-black text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
          aria-expanded={detailsOpen}
        >
          {detailsOpen ? "Hide details" : "Add more details"}
        </button>

        {detailsOpen && (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextInput label="Vendor" name="vendor" value={form.vendor} onChange={handleChange} />
              <TextInput
                label="Amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={handleChange}
              />
              <label>
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Purchase date
                </span>
                <input
                  type="date"
                  name="purchaseDate"
                  value={form.purchaseDate}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <DateQuickButtons name="purchaseDate" onChange={handleChange} />
              </label>
              <SelectInput
                label="Category"
                name="category"
                value={form.category}
                options={CATEGORY_OPTIONS}
                onChange={handleChange}
              />
              <label>
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Tags
                </span>
                <input
                  type="text"
                  name="tags"
                  value={form.tags}
                  onChange={handleChange}
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
                  onChange={handleChange}
                  rows="3"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
          >
            {uploading ? "Uploading..." : "Upload receipt"}
          </button>
        </div>
      </form>
    </Modal>
  );
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

const SelectInput = ({ label, name, value, options, onChange }) => (
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
          {option}
        </option>
      ))}
    </select>
  </label>
);

export default ReceiptUploadModal;
