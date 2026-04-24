import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import GroupForm from "../components/GroupForm";

const Groups = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
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

  const handleGroupCreated = (group) => {
    setGroups((prev) => [group, ...prev]);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-600 mb-2">Shared Expenses</p>
            <h1 className="text-3xl font-black text-slate-900">Groups</h1>
            <p className="text-slate-500">
              Create a group and track who owes whom.
            </p>
          </div>

          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-100"
          >
            Back to dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4">
            <GroupForm onCreated={handleGroupCreated} />
          </div>

          <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 md:px-6">
              <div className="flex items-center justify-between gap-3">
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

            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="px-6 py-10 text-center text-slate-400 font-medium">
                  Loading groups...
                </div>
              ) : error ? (
                <div className="px-6 py-10 text-center">
                  <p className="font-semibold text-rose-700">{error}</p>
                </div>
              ) : groups.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="font-semibold text-slate-700">No groups yet.</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Create your first group to start tracking shared balances.
                  </p>
                </div>
              ) : (
                groups.map((group) => (
                  <button
                    key={group._id}
                    type="button"
                    onClick={() => navigate(`/groups/${group._id}/summary`)}
                    className="w-full px-5 py-4 text-left transition hover:bg-slate-50 md:px-6"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-base font-bold text-slate-900 truncate">
                          {group.name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {group.members?.length || 0} member
                          {(group.members?.length || 0) === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-indigo-600">
                        View summary
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Groups;
