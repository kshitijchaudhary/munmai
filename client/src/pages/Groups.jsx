import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { deleteGroup, updateGroup } from "../api/groups";
import GroupForm from "../components/GroupForm";
import GroupManageModal from "../components/GroupManageModal";
import JoinGroupModal from "../components/JoinGroupModal";
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
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10 lg:ml-72 lg:w-auto">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-600 mb-2">Shared Expenses</p>
            <h1 className="text-3xl font-black text-slate-900">Groups</h1>
            <p className="text-slate-500">
              Create a group and track who owes whom.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setJoinGroupModalOpen(true)}
              className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 sm:w-auto"
            >
              Join Group
            </button>

            <Link
              to="/dashboard"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-100 sm:w-auto"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4">
            <GroupForm onCreated={handleGroupCreated} />
          </div>

          <div className="overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white shadow-sm lg:col-span-8">
            <div className="border-b border-slate-100 px-5 py-5 md:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Your Groups</h2>
                  <p className="text-sm text-slate-500">
                    Open a group to view balances, shared expenses, and settlements.
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

            <div className="space-y-3 bg-slate-50/40 p-3 md:p-4">
              {loading ? (
                <div className="rounded-3xl bg-white px-6 py-10 text-center font-medium text-slate-400">
                  Loading groups...
                </div>
              ) : error ? (
                <div className="rounded-3xl bg-white px-6 py-10 text-center">
                  <p className="font-semibold text-rose-700">{error}</p>
                </div>
              ) : groups.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                  <p className="text-lg font-black text-slate-900">
                    Create your first group to track shared expenses.
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                    Use the form beside this list to add roommates, trips, or
                    shared household expenses.
                  </p>
                </div>
              ) : (
                groups.map((group) => {
                  const memberCount = getMemberCount(group);
                  const isOwner = isGroupOwner(group, user);

                  return (
                    <div
                      key={group._id}
                      className="rounded-3xl border border-slate-100 bg-white px-5 py-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md md:px-6"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-lg font-black text-slate-900">
                              {group.name}
                            </p>
                            {isOwner && (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-slate-600">
                                You own this group
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
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
                            View
                          </button>
                          {isOwner && (
                            <>
                              <button
                                type="button"
                                onClick={() => openManageGroup(group)}
                                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 sm:w-auto"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => openManageGroup(group)}
                                className="inline-flex w-full items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 sm:w-auto"
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
        </div>

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
