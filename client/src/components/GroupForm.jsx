import { useState } from "react";
import api from "../api/axios";

const parseMemberIds = (value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const GroupForm = ({ onCreated }) => {
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setStatusMessage(null);

    const trimmedName = name.trim();

    if (!trimmedName) {
      setStatusMessage({
        type: "error",
        text: "Group name is required.",
      });
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        name: trimmedName,
        memberIds: parseMemberIds(memberIds),
      };

      const { data } = await api.post("/groups", payload);

      setName("");
      setMemberIds("");
      setStatusMessage({
        type: "success",
        text: "Group created successfully.",
      });

      if (onCreated) {
        onCreated(data);
      }
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to create group.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-900">Create Group</h2>
        <p className="text-sm text-slate-500">
          Start a shared tab and add member IDs now or later.
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
            Group name
          </label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Trip to Montreal"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={submitting}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Member IDs
          </label>
          <input
            type="text"
            value={memberIds}
            onChange={(event) => setMemberIds(event.target.value)}
            placeholder="userId1, userId2"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={submitting}
          />
          <p className="mt-1 text-xs text-slate-500">
            Use comma-separated user IDs. Your account is added automatically.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:bg-indigo-400"
        >
          {submitting ? "Creating group..." : "Create group"}
        </button>
      </form>
    </div>
  );
};

export default GroupForm;
