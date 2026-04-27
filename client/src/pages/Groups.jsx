import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import GroupForm from "../components/GroupForm";
import Sidebar from "../components/Sidebar";

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

  const handleGroupCreated = () => {
    fetchGroups();
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

          <Link
            to="/dashboard"
            className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-100 sm:w-auto"
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
                  <p className="font-semibold text-slate-700">
                    Create your first group to track shared expenses.
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Use the form beside this list to add roommates, trips, or
                    shared household expenses.
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
      </main>
    </div>
  );
};

export default Groups;
