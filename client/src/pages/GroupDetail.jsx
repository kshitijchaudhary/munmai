import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import BalanceSummary from "../components/BalanceSummary";
import OpeningBalanceForm from "../components/OpeningBalanceForm";
import SharedExpenseForm from "../components/SharedExpenseForm";
import SettlementForm from "../components/SettlementForm";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(value || 0));

const formatDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString();
};

const GroupDetail = () => {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [openingBalances, setOpeningBalances] = useState([]);
  const [sharedExpenses, setSharedExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState("");
  const [deleteState, setDeleteState] = useState({
    id: "",
    message: "",
  });

  const memberIds = useMemo(
    () => (Array.isArray(group?.members) ? group.members.map(String) : []),
    [group]
  );

  const fetchGroupData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [
        groupResponse,
        openingBalanceResponse,
        sharedExpenseResponse,
        settlementResponse,
      ] =
        await Promise.all([
          api.get(`/groups/${groupId}`),
          api.get("/opening-balances", { params: { groupId } }),
          api.get("/shared-expenses", { params: { groupId } }),
          api.get("/settlements", { params: { groupId } }),
        ]);

      setGroup(groupResponse.data);
      setOpeningBalances(
        Array.isArray(openingBalanceResponse.data)
          ? [...openingBalanceResponse.data].sort((a, b) => {
              const effectiveDateDiff =
                new Date(a.effectiveDate) - new Date(b.effectiveDate);

              if (effectiveDateDiff !== 0) {
                return effectiveDateDiff;
              }

              return new Date(a.createdAt) - new Date(b.createdAt);
            })
          : []
      );
      setSharedExpenses(
        Array.isArray(sharedExpenseResponse.data)
          ? [...sharedExpenseResponse.data].sort(
              (a, b) => new Date(b.expenseDate) - new Date(a.expenseDate)
            )
          : []
      );
      
      setSettlements(
        Array.isArray(settlementResponse.data)
          ? [...settlementResponse.data].sort(
              (a, b) => new Date(b.settlementDate) - new Date(a.settlementDate)
            )
          : []
      );
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || "Failed to load group details.");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const fetchBalances = useCallback(async () => {
    try {
      setBalanceLoading(true);
      setBalanceError("");

      const { data } = await api.get(`/balance/${groupId}`);
      setBalances(Array.isArray(data?.balances) ? data.balances : []);
    } catch (fetchError) {
      setBalanceError(
        fetchError.response?.data?.message || "Failed to load balances."
      );
    } finally {
      setBalanceLoading(false);
    }
  }, [groupId]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchGroupData(), fetchBalances()]);
  }, [fetchBalances, fetchGroupData]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleSharedExpenseCreated = async () => {
    await refreshAll();
  };

  const handleSettlementCreated = async () => {
    await refreshAll();
  };

  const handleOpeningBalanceCreated = async () => {
    await refreshAll();
  };

  const handleDeleteSharedExpense = async (expenseId) => {
    const confirmed = window.confirm(
      "Delete this shared expense? Balances will be recalculated."
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeleteState({ id: expenseId, message: "" });
      await api.delete(`/shared-expenses/${expenseId}`);
      await refreshAll();
      setDeleteState({
        id: "",
        message: "Shared expense deleted successfully.",
      });
    } catch (deleteError) {
      setDeleteState({
        id: "",
        message:
          deleteError.response?.data?.message || "Failed to delete shared expense.",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400 font-medium">
        Loading group details...
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-10">
          <Link
            to="/groups"
            className="inline-flex items-center rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-100"
          >
            Back to groups
          </Link>

          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-5 text-rose-700">
            <p className="font-semibold">{error || "Group not found."}</p>
          </div>
        </div>
      </div>
    );
  }

  if (memberIds.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-10">
        <Link
            to="/groups"
            className="inline-flex items-center rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-100"
          >
            Back to groups
          </Link>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-amber-700">
            <p className="font-semibold">This group has no members yet.</p>
            <p className="mt-2 text-sm">
              Add members before recording shared expenses or settlements.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-600 mb-2">
              Shared Expense Group
            </p>
            <h1 className="text-3xl font-black text-slate-900">{group.name}</h1>
            <p className="mt-2 text-slate-500">
              {memberIds.length} member{memberIds.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/groups"
              className="inline-flex items-center rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-100"
            >
              Back to groups
            </Link>

            <button
              type="button"
              onClick={refreshAll}
              className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-8 rounded-2xl bg-white border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Members</h2>
          <div className="flex flex-wrap gap-2">
            {memberIds.map((memberId) => (
              <span
                key={memberId}
                className="inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                {memberId}
              </span>
            ))}
          </div>
        </div>

        {deleteState.message && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
              deleteState.message.toLowerCase().includes("failed")
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {deleteState.message}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          <div className="xl:col-span-4 space-y-8">
            <BalanceSummary
              balances={balances}
              loading={balanceLoading}
              error={balanceError}
            />

            <OpeningBalanceForm
              groupId={groupId}
              members={memberIds}
              onCreated={handleOpeningBalanceCreated}
            />

            <SharedExpenseForm
              groupId={groupId}
              members={memberIds}
              onCreated={handleSharedExpenseCreated}
            />

            <SettlementForm
              groupId={groupId}
              members={memberIds}
              onCreated={handleSettlementCreated}
            />
          </div>

          <div className="xl:col-span-8 space-y-8">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4 md:px-6">
                <h2 className="text-lg font-bold text-slate-900">Opening Balances</h2>
                <p className="text-sm text-slate-500">
                  Starting balances carried into this group.
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {openingBalances.length === 0 ? (
                  <div className="px-6 py-10 text-center text-slate-500">
                    No opening balances recorded yet.
                  </div>
                ) : (
                  openingBalances.map((openingBalance) => (
                    <div
                      key={openingBalance._id}
                      className="px-5 py-4 md:px-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 break-all">
                          {String(openingBalance.fromUser)} owes{" "}
                          {String(openingBalance.toUser)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {openingBalance.note || "No note"}
                        </p>
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mt-2">
                          {formatDate(openingBalance.effectiveDate)}
                        </p>
                      </div>

                      <p className="text-lg font-black text-amber-600">
                        {formatCurrency(openingBalance.amount)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4 md:px-6">
                <h2 className="text-lg font-bold text-slate-900">Recent Shared Expenses</h2>
                <p className="text-sm text-slate-500">
                  Latest shared charges recorded for this group.
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {sharedExpenses.length === 0 ? (
                  <div className="px-6 py-10 text-center text-slate-500">
                    No shared expenses recorded yet.
                  </div>
                ) : (
                  sharedExpenses.map((expense) => (
                    <div
                      key={expense._id}
                      className="px-5 py-4 md:px-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900">
                          {expense.description || "Shared expense"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 break-all">
                          Paid by: {String(expense.paidBy)}
                        </p>
                        <p className="text-sm text-slate-500 break-all">
                          Participants: {(expense.participants || []).map(String).join(", ")}
                        </p>
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mt-2">
                          {formatDate(expense.expenseDate)} | Equal split
                        </p>
                      </div>

                      <div className="flex items-center gap-4 md:flex-col md:items-end">
                        <p className="text-lg font-black text-slate-900">
                          {formatCurrency(expense.amount)}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleDeleteSharedExpense(expense._id)}
                          disabled={deleteState.id === expense._id}
                          className="text-sm font-semibold text-rose-600 hover:underline disabled:text-slate-400"
                        >
                          {deleteState.id === expense._id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4 md:px-6">
                <h2 className="text-lg font-bold text-slate-900">Recent Settlements</h2>
                <p className="text-sm text-slate-500">
                  Payment history that reduces outstanding balances.
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {settlements.length === 0 ? (
                  <div className="px-6 py-10 text-center text-slate-500">
                    No settlements recorded yet.
                  </div>
                ) : (
                  settlements.map((settlement) => (
                    <div
                      key={settlement._id}
                      className="px-5 py-4 md:px-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 break-all">
                          {String(settlement.fromUser)} paid {String(settlement.toUser)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {settlement.note || "No note"}
                        </p>
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mt-2">
                          {formatDate(settlement.settlementDate)}
                        </p>
                      </div>

                      <p className="text-lg font-black text-emerald-600">
                        {formatCurrency(settlement.amount)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupDetail;
