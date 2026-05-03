import { useState } from "react";
import Modal from "./Modal";

const GroupManageModal = ({
  open,
  onClose,
  group,
  groupNameDraft,
  onGroupNameDraftChange,
  onRename,
  onDelete,
  saving = false,
  deleting = false,
  message = null,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleClose = () => {
    setConfirmDelete(false);
    onClose();
  };

  const handleDelete = async () => {
    await onDelete();
    setConfirmDelete(false);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Manage Group"
      description="Update this group's settings."
    >
      <div className="space-y-5">
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

        <section className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4 md:p-5">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
              Group Name
            </p>
            <h3 className="mt-1 break-words text-lg font-black text-slate-900">
              {group?.name || "Untitled group"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Use a clear name your members will recognize.
            </p>
          </div>

          <form onSubmit={onRename} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                New group name
              </span>
              <input
                type="text"
                value={groupNameDraft}
                onChange={(event) =>
                  onGroupNameDraftChange(event.target.value)
                }
                disabled={saving || deleting}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
              />
            </label>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || deleting}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:bg-slate-400 sm:w-auto"
              >
                {saving ? "Saving..." : "Rename Group"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-rose-100 bg-white p-4 md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-rose-400">
                Danger Zone
              </p>
              <h3 className="mt-1 text-base font-black text-slate-900">
                Delete this group
              </h3>
              <p className="mt-1 max-w-xl text-sm text-slate-500">
                Deletion is permanent and removes this group's shared expense
                history, settlements, and memberships.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={saving || deleting}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:text-rose-300 sm:w-auto"
            >
              Delete Group
            </button>
          </div>

          {confirmDelete && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-semibold text-rose-900">
                This will permanently delete this group and its shared expense
                history.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:bg-rose-300"
                >
                  {deleting ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
};

export default GroupManageModal;
