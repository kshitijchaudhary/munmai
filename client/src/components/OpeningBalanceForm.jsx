import { useMemo, useState } from "react";
import api from "../api/axios";

const OpeningBalanceForm = ({ groupId, members = [], onCreated }) => {
  const [formData, setFormData] = useState({
    fromUser: "",
    toUser: "",
    amount: "",
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const memberOptions = useMemo(
    () =>
      members.map((memberId) => ({
        value: String(memberId),
        label: String(memberId),
      })),
    [members]
  );

  const fromUserOptions = useMemo(
    () =>
      memberOptions.filter((member) => member.value !== formData.toUser),
    [memberOptions, formData.toUser]
  );
  
  const toUserOptions = useMemo(
    () =>
      memberOptions.filter((member) => member.value !== formData.fromUser),
    [memberOptions, formData.fromUser]
  );

  const resetForm = () => {
    setFormData({
      fromUser: "",
      toUser: "",
      amount: "",
      note: "",
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setStatusMessage(null);

    if (!formData.fromUser || !formData.toUser) {
      setStatusMessage({
        type: "error",
        text: "Select both users for the opening balance.",
      });
      return;
    }

    if (formData.fromUser === formData.toUser) {
      setStatusMessage({
        type: "error",
        text: "Opening balance users must be different.",
      });
      return;
    }

    if (!formData.amount || Number(formData.amount) <= 0) {
      setStatusMessage({
        type: "error",
        text: "Amount must be greater than 0.",
      });
      return;
    }

    try {
      setSubmitting(true);

      await api.post("/opening-balances", {
        groupId,
        fromUser: formData.fromUser,
        toUser: formData.toUser,
        amount: Number(formData.amount),
        note: formData.note.trim(),
      });

      resetForm();
      setStatusMessage({
        type: "success",
        text: "Opening balance recorded.",
      });

      if (onCreated) {
        await onCreated();
      }
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to record opening balance.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">Add Opening Balance</h3>
        <p className="text-sm text-slate-500">
          Record starting debt before new shared expenses begin.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
            statusMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            From user
          </label>
        <select
          value={formData.fromUser}
          onChange={(event) =>
            setFormData((prev) => ({
              ...prev,
              fromUser: event.target.value,
              toUser: prev.toUser === event.target.value ? "" : prev.toUser,
            }))
          }
          disabled={submitting}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Select debtor</option>
          {fromUserOptions.map((member) => (
            <option key={member.value} value={member.value}>
              {member.label}
            </option>
          ))}
        </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            To user
          </label>
        <select
          value={formData.toUser}
          onChange={(event) =>
            setFormData((prev) => ({
              ...prev,
              toUser: event.target.value,
              fromUser: prev.fromUser === event.target.value ? "" : prev.fromUser,
            }))
          }
          disabled={submitting}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Select creditor</option>
          {toUserOptions.map((member) => (
            <option key={member.value} value={member.value}>
              {member.label}
            </option>
          ))}
        </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Amount
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.amount}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, amount: event.target.value }))
            }
            placeholder="75.00"
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Note
          </label>
          <input
            type="text"
            value={formData.note}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, note: event.target.value }))
            }
            placeholder="Balance carried forward"
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-amber-600 disabled:bg-amber-300"
        >
          {submitting ? "Saving opening balance..." : "Add opening balance"}
        </button>
      </form>
    </div>
  );
};

export default OpeningBalanceForm;
