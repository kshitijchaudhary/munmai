import { useState } from "react";
import { requestGroupJoin } from "../api/groups";
import Modal from "./Modal";

const JoinGroupModal = ({ open, onClose, onJoined }) => {
  const [joinCode, setJoinCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const handleClose = () => {
    setJoinCode("");
    setMessage(null);
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedJoinCode = joinCode.trim().toUpperCase();

    if (!normalizedJoinCode) {
      setMessage({ type: "error", text: "Join code is required." });
      return;
    }

    try {
      setSubmitting(true);
      setMessage(null);
      const data = await requestGroupJoin(normalizedJoinCode);
      setJoinCode("");
      setMessage({
        type: "success",
        text:
          data?.message ||
          "Join request sent. The group owner needs to approve it.",
      });
      onJoined?.();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Could not send join request. Check the code and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Join Group"
      description="Enter a join code shared by an active group member."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {message?.text && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">
            Join code
          </span>
          <input
            type="text"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            placeholder="MUN-8K4P2Q"
            disabled={submitting}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold uppercase tracking-wider outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
          />
        </label>

        <p className="text-sm text-slate-500">
          The group owner must approve your request before you can access the
          group.
        </p>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300"
        >
          {submitting ? "Sending request..." : "Send Join Request"}
        </button>
      </form>
    </Modal>
  );
};

export default JoinGroupModal;
