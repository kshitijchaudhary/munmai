import { useEffect, useMemo, useState } from "react";
import { createGroupSettlement } from "../api/groups";

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

const SettlementForm = ({ groupId, members = [], settlementDraft, onCreated }) => {
  const [formData, setFormData] = useState({
    from: "",
    to: "",
    amount: "",
    note: "",
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
  
  const fromUserOptions = useMemo(
    () =>
      memberOptions.filter((member) => member.value !== formData.to),
    [memberOptions, formData.to]
  );
  
  const toUserOptions = useMemo(
    () =>
      memberOptions.filter((member) => member.value !== formData.from),
    [memberOptions, formData.from]
  );

  useEffect(() => {
    if (!settlementDraft) {
      return;
    }

    setFormData({
      from: settlementDraft.from || "",
      to: settlementDraft.to || "",
      amount:
        settlementDraft.amount === undefined || settlementDraft.amount === null
          ? ""
          : String(settlementDraft.amount),
      note: settlementDraft.note || "",
    });
    setStatusMessage(null);
  }, [settlementDraft]);

  const resetForm = () => {
    setFormData({
      from: "",
      to: "",
      amount: "",
      note: "",
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setStatusMessage(null);

    if (!formData.from || !formData.to) {
      setStatusMessage({
        type: "error",
        text: "Select both users for the settlement.",
      });
      return;
    }

    if (formData.from === formData.to) {
      setStatusMessage({
        type: "error",
        text: "Settlement users must be different.",
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

      await createGroupSettlement(groupId, {
        from: formData.from,
        to: formData.to,
        amount: Number(formData.amount),
        note: formData.note.trim(),
      });

      resetForm();
      setStatusMessage({
        type: "success",
        text: "Settlement recorded.",
      });

      if (onCreated) {
        await onCreated();
      }
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to record settlement.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">Record Settlement</h3>
        <p className="text-sm text-slate-500">
          Log who paid back whom and how much.
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
            From user
          </label>
          <select
            value={formData.from}
            onChange={(event) =>
              setFormData((prev) => ({
                ...prev,
                from: event.target.value,
                to: prev.to === event.target.value ? "" : prev.to,
              }))
            }
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select payer</option>
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
            value={formData.to}
            onChange={(event) =>
              setFormData((prev) => ({
                ...prev,
                to: event.target.value,
                from: prev.from === event.target.value ? "" : prev.from,
              }))
            }
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select receiver</option>
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
            placeholder="50.00"
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
            placeholder="Cash, e-transfer, reimbursement"
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:bg-emerald-400"
        >
          {submitting ? "Saving settlement..." : "Record settlement"}
        </button>
      </form>
    </div>
  );
};

export default SettlementForm;
