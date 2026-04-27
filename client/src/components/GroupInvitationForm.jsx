import { useState } from "react";
import { createGroupInvitation } from "../api/groups";

const GroupInvitationForm = ({ groupId }) => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextEmail = email.trim();

    if (!nextEmail) {
      setMessage({ type: "error", text: "Email is required." });
      return;
    }

    try {
      setSubmitting(true);
      setMessage(null);
      await createGroupInvitation(groupId, nextEmail);
      setEmail("");
      setMessage({ type: "success", text: "Invite sent." });
    } catch (error) {
      const statusCode = error.response?.status;
      const serverMessage = error.response?.data?.message || "";
      const isMissingUser =
        statusCode === 404 && serverMessage.toLowerCase().includes("user");

      setMessage({
        type: "error",
        text: isMissingUser
          ? "This email is not registered on Munmai yet."
          : serverMessage || "Failed to send invite.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:p-6"
    >
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">Invite Member</h2>
        <p className="text-sm text-slate-500">
          Invite existing Munmai users by email.
        </p>
      </div>

      {message?.text && (
        <div
          className={`mb-4 rounded-xl border px-3 py-2 text-sm font-medium ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="user@example.com"
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={submitting}
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:bg-slate-300"
        >
          {submitting ? "Sending..." : "Send Invite"}
        </button>
      </div>
    </form>
  );
};

export default GroupInvitationForm;
