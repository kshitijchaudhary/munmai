import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { deleteGroup, updateGroup } from "../api/groups";
import GroupForm from "../components/GroupForm";
import GroupManageModal from "../components/GroupManageModal";
import JoinGroupModal from "../components/JoinGroupModal";
import Modal from "../components/Modal";
import Sidebar from "../components/Sidebar";
import { AuthContext } from "../context/authContext";

const getUserId = (user) => String(user?.id || user?._id || "");

const getMemberCount = (group) =>
  Number(group?.memberCount || group?.members?.length || 0);

const isGroupOwner = (group, user) =>
  String(group?.createdBy?._id || group?.createdBy || "") === getUserId(user);

const Groups = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [groups, setGroups] = useState([]);
  const [managingGroup, setManagingGroup] = useState(null);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [groupActionMessage, setGroupActionMessage] = useState(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  const [joinGroupModalOpen, setJoinGroupModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchGroups = async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await api.get("/groups");
      setGroups(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || "Failed to load groups.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleGroupCreated = () => {
    fetchGroups();
    setCreateGroupModalOpen(false);
  };

  const openManageGroup = (group) => {
    setManagingGroup(group);
    setGroupNameDraft(group.name || "");
    setGroupActionMessage(null);
  };

  const handleUpdateGroup = async (event) => {
    event.preventDefault();

    const nextName = groupNameDraft.trim();

    if (!nextName) {
      setGroupActionMessage({ type: "error", text: "Group name is required." });
      return;
    }

    try {
      setSavingGroup(true);
      setGroupActionMessage(null);
      const updatedGroup = await updateGroup(managingGroup._id, {
        name: nextName,
      });

      setGroups((prev) =>
        prev.map((group) =>
          group._id === managingGroup._id
            ? { ...group, ...(updatedGroup || {}), name: updatedGroup?.name || nextName }
            : group
        )
      );
      setManagingGroup(null);
    } catch (actionError) {
      setGroupActionMessage({
        type: "error",
        text: actionError.response?.data?.message || "Failed to update group.",
      });
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    try {
      setDeletingGroup(true);
      setGroupActionMessage(null);
      await deleteGroup(managingGroup._id);
      setGroups((prev) => prev.filter((group) => group._id !== managingGroup._id));
      setManagingGroup(null);
    } catch (actionError) {
      setGroupActionMessage({
        type: "error",
        text: actionError.response?.data?.message || "Failed to delete group.",
      });
    } finally {
      setDeletingGroup(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10 lg:ml-72 lg:w-auto">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-indigo-600">Shared Expenses</p>
            <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">
              Groups
            </h1>
            <p className="max-w-2xl text-slate-500 dark:text-slate-400">
              Open a group to manage shared expenses, balances, settlements, and
              members.
            </p>
          </div>
        </div>

        <div className="mb-8 grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setCreateGroupModalOpen(true)}
            className="rounded-[1.5rem] border border-slate-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/60"
          >
            <p className="text-sm font-black uppercase tracking-widest text-indigo-600">
              Create group
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Start a shared money space for a trip, home, or project.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setJoinGroupModalOpen(true)}
            className="rounded-[1.5rem] border border-slate-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/60"
          >
            <p className="text-sm font-black uppercase tracking-widest text-indigo-600">
              Join with code
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Use a group code shared by another member.
            </p>
          </button>

          <Link
            to="/group-invitations"
            className="rounded-[1.5rem] border border-slate-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/60"
          >
            <p className="text-sm font-black uppercase tracking-widest text-indigo-600">
              Invitations
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Review group invites and join requests.
            </p>
          </Link>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-5 py-5 dark:border-slate-800 md:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Your Groups
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Open a group to manage shared expenses, balances,
                    settlements, and members.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={fetchGroups}
                  className="text-sm font-semibold text-indigo-600 hover:underline"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="space-y-3 bg-slate-50/40 p-3 dark:bg-slate-950/40 md:p-4">
              {loading ? (
                <div className="rounded-3xl bg-white px-6 py-10 text-center font-medium text-slate-400 dark:bg-slate-900">
                  Loading groups...
                </div>
              ) : error ? (
                <div className="rounded-3xl bg-white px-6 py-10 text-center dark:bg-slate-900">
                  <p className="font-semibold text-rose-700">{error}</p>
                </div>
              ) : groups.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                    Create your first group to track shared expenses.
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                    Use Create group or Join with code to add roommates, trips,
                    or shared household expenses.
                  </p>
                </div>
              ) : (
                groups.map((group) => {
                  const memberCount = getMemberCount(group);
                  const isOwner = isGroupOwner(group, user);

                  return (
                    <div
                      key={group._id}
                      className="rounded-3xl border border-slate-100 bg-white px-5 py-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 md:px-6"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-lg font-black text-slate-900 dark:text-slate-100">
                              {group.name}
                            </p>
                            {isOwner && (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                You own this group
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {memberCount} member{memberCount === 1 ? "" : "s"} -
                            Shared money workspace
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <button
                            type="button"
                            onClick={() => navigate(`/groups/${group._id}/summary`)}
                            className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 sm:w-auto"
                          >
                            Open
                          </button>
                          {isOwner && (
                            <>
                              <button
                                type="button"
                                onClick={() => openManageGroup(group)}
                                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => openManageGroup(group)}
                                className="inline-flex w-full items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 dark:border-rose-900/70 dark:bg-slate-950 dark:text-rose-300 dark:hover:bg-rose-950/30 sm:w-auto"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
        </div>

        <Modal
          open={createGroupModalOpen}
          onClose={() => setCreateGroupModalOpen(false)}
          title="Create group"
          description="Start a shared money space and invite members now or later."
        >
          <GroupForm
            onCreated={handleGroupCreated}
            showHeader={false}
            variant="plain"
          />
        </Modal>

        <JoinGroupModal
          open={joinGroupModalOpen}
          onClose={() => setJoinGroupModalOpen(false)}
          onJoined={fetchGroups}
        />

        <GroupManageModal
          open={Boolean(managingGroup)}
          onClose={() => setManagingGroup(null)}
          group={managingGroup}
          groupNameDraft={groupNameDraft}
          onGroupNameDraftChange={setGroupNameDraft}
          onRename={handleUpdateGroup}
          onDelete={handleDeleteGroup}
          saving={savingGroup}
          deleting={deletingGroup}
          message={groupActionMessage}
        />
      </main>
    </div>
  );
};

export default Groups;
