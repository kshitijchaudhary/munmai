import { useMemo, useState } from "react";
import { createSharedExpense } from "../api/groups";

const getMemberId = (member) => String(member?._id || member?.id || member || "");

const getMemberLabel = (member) => {
  if (member?.username) {
    return `@${member.username}`;
  }

  if (member?.name) {
    return member.name;
  }

  if (member?.email) {
    return member.email;
  }

  const memberId = getMemberId(member);
  return memberId ? `Member ${memberId.slice(-6)}` : "Unknown member";
};

const SharedExpenseForm = ({ groupId, members = [], onCreated }) => {
  const [formData, setFormData] = useState({
    paidBy: "",
    participants: [],
    amount: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const memberOptions = useMemo(
    () =>
      members
        .map((member) => ({
          value: getMemberId(member),
          label: getMemberLabel(member),
        }))
        .filter((member) => member.value),
    [members]
  );

  const handleParticipantToggle = (memberId) => {
    setFormData((prev) => {
      const exists = prev.participants.includes(memberId);

      return {
        ...prev,
        participants: exists
          ? prev.participants.filter((value) => value !== memberId)
          : [...prev.participants, memberId],
      };
    });
  };

  const resetForm = () => {
    setFormData({
      paidBy: "",
      participants: [],
      amount: "",
      description: "",
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
  
    setStatusMessage(null);
  
    if (!formData.paidBy) {
      setStatusMessage({
        type: "error",
        text: "Select who paid for this expense.",
      });
      return;
    }
  
    if (formData.participants.length === 0) {
      setStatusMessage({
        type: "error",
        text: "Select at least one participant.",
      });
      return;
    }
  
    if (!formData.participants.includes(formData.paidBy)) {
      setStatusMessage({
        type: "error",
        text: "Payer must be included in participants.",
      });
      return;
    }

    if (!formData.paidBy) {
      setStatusMessage({
        type: "error",
        text: "Select who paid for this expense.",
      });
      return;
    }
    
    if (formData.participants.length === 0) {
      setStatusMessage({
        type: "error",
        text: "Select at least one participant.",
      });
      return;
    }
    
    if (!formData.participants.includes(formData.paidBy)) {
      setStatusMessage({
        type: "error",
        text: "Payer must be included in participants.",
      });
      return;
    }
    
    if (
      formData.participants.length === 1 &&
      formData.participants[0] === formData.paidBy
    ) {
      setStatusMessage({
        type: "error",
        text: "Select at least one other participant besides the payer.",
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
  
      await createSharedExpense({
        groupId,
        paidBy: formData.paidBy,
        participants: formData.participants,
        amount: Number(formData.amount),
        description: formData.description.trim(),
      });
  
      resetForm();
      setStatusMessage({
        type: "success",
        text: "Shared expense added.",
      });
  
      if (onCreated) {
        await onCreated();
      }
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to add shared expense.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">Add Shared Expense</h3>
        <p className="text-sm text-slate-500">
          Equal split only in this phase.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`mb-4 break-words rounded-xl border px-4 py-3 text-sm font-medium ${
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
            Paid by
          </label>
          <select
            value={formData.paidBy}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, paidBy: event.target.value }))
            }
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select payer</option>
            {memberOptions.map((member) => (
              <option key={member.value} value={member.value}>
                {member.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-2 block text-sm font-semibold text-slate-700">
            Participants
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {memberOptions.map((member) => (
              <label
                key={member.value}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={formData.participants.includes(member.value)}
                  onChange={() => handleParticipantToggle(member.value)}
                  disabled={submitting}
                />
                <span className="truncate">{member.label}</span>
              </label>
            ))}
          </div>
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
            placeholder="120.50"
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Description
          </label>
          <input
            type="text"
            value={formData.description}
            onChange={(event) =>
              setFormData((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
            placeholder="Dinner, groceries, gas"
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:bg-slate-400"
        >
          {submitting ? "Saving expense..." : "Add shared expense"}
        </button>
      </form>
    </div>
  );
};

export default SharedExpenseForm;
