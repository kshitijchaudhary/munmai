import { useCallback, useContext, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getGroupMembers, getGroupSummary } from "../api/groups";
import GroupInvitationForm from "../components/GroupInvitationForm";
import Sidebar from "../components/Sidebar";
import SettlementForm from "../components/SettlementForm";
import SharedExpenseForm from "../components/SharedExpenseForm";
import { AuthContext } from "../context/AuthContext";

const emptySummary = {
  expenseCount: 0,
  settlementCount: 0,
  totalExpenses: 0,
  totalSettlements: 0,
  totalYouOwe: 0,
  totalYouAreOwed: 0,
  netBalance: 0,
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(value || 0));

const getBalanceTone = (value) => {
  const amount = Number(value || 0);

  if (amount > 0) return "text-emerald-600";
  if (amount < 0) return "text-rose-600";
  return "text-slate-900";
};

const getUserId = (user) => String(user?.id || user?._id || "");

const getReadableUserName = (value, currentUser) => {
  const valueId = String(value?._id || value?.id || value || "");
  const currentUserId = getUserId(currentUser);

  if (valueId && valueId === currentUserId) {
    return "You";
  }

  if (value?.name) {
    return value.name;
  }

  if (value?.email) {
    return value.email;
  }

  return valueId ? `Member ${valueId.slice(-6)}` : "Unknown member";
};

const getBalanceLabel = (balance, currentUser) => {
  const fromId = String(balance.from?._id || balance.from?.id || balance.from || "");
  const toId = String(balance.to?._id || balance.to?.id || balance.to || "");
  const currentUserId = getUserId(currentUser);

  if (fromId === currentUserId) {
    return `You owe ${getReadableUserName(balance.to, currentUser)}`;
  }

  if (toId === currentUserId) {
    return `${getReadableUserName(balance.from, currentUser)} owes You`;
  }

  return `${getReadableUserName(balance.from, currentUser)} owes ${getReadableUserName(
    balance.to,
    currentUser
  )}`;
};

const getUserObjectId = (value) => String(value?._id || value?.id || value || "");

const getCurrentUserOption = (user) => {
  const userId = getUserId(user);

  if (!userId) {
    return null;
  }

  return {
    _id: userId,
    name: user?.name || "You",
    email: user?.email || "",
  };
};

const getSelectableMembers = (balances, currentUser) => {
  const membersById = new Map();
  const currentUserOption = getCurrentUserOption(currentUser);

  if (currentUserOption) {
    membersById.set(currentUserOption._id, currentUserOption);
  }

  for (const balance of balances) {
    for (const member of [balance.from, balance.to]) {
      const memberId = getUserObjectId(member);

      if (memberId && !membersById.has(memberId)) {
        membersById.set(memberId, member);
      }
    }
  }

  return [...membersById.values()];
};

const getActiveMemberOptions = (memberships = [], pendingInvites = []) => {
  const membersById = new Map();
  const pendingUserIds = new Set(
    pendingInvites
      .map((membership) => getUserObjectId(membership?.userId))
      .filter(Boolean)
  );

  for (const membership of memberships) {
    if (membership?.status !== "active") {
      continue;
    }

    const member = membership.userId;
    const memberId = getUserObjectId(member);

    if (pendingUserIds.has(memberId)) {
      continue;
    }

    if (memberId && !membersById.has(memberId)) {
      membersById.set(memberId, {
        _id: memberId,
        name: member?.name || member?.email || `Member ${memberId.slice(-6)}`,
        email: member?.email || "",
      });
    }
  }

  return [...membersById.values()];
};

const GroupSummary = () => {
  const { groupId } = useParams();
  const { user } = useContext(AuthContext);
  const [groupSummary, setGroupSummary] = useState({
    group: null,
    summary: emptySummary,
    balances: [],
  });
  const [activeMembers, setActiveMembers] = useState([]);
  const [membersError, setMembersError] = useState("");
  const [settlementDraft, setSettlementDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSummary = useCallback(async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      setError("");

      const [summaryResult, membersResult] = await Promise.allSettled([
        getGroupSummary(groupId),
        getGroupMembers(groupId),
      ]);

      if (summaryResult.status === "rejected") {
        throw summaryResult.reason;
      }

      const data = summaryResult.value;
      setGroupSummary({
        group: data?.group || null,
        summary: {
          ...emptySummary,
          ...(data?.summary || {}),
        },
        balances: Array.isArray(data?.balances) ? data.balances : [],
      });

      if (membersResult.status === "fulfilled") {
        setActiveMembers(
          getActiveMemberOptions(
            membersResult.value?.activeMembers,
            membersResult.value?.pendingInvites
          )
        );
        setMembersError("");
      } else {
        setActiveMembers([]);
        setMembersError("Could not load group members. Showing limited member options.");
      }
    } catch (fetchError) {
      setError(
        fetchError.response?.data?.message || "Failed to load group summary."
      );
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400 font-bold">
        Loading group summary...
      </div>
    );
  }

  if (error || !groupSummary.group) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
          <Link
            to="/groups"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-100"
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

  const { group, summary, balances } = groupSummary;
  const fallbackMembers = getSelectableMembers(balances, user);
  const selectableMembers = activeMembers.length > 0 ? activeMembers : fallbackMembers;
  const currentUserId = getUserId(user);
  const balancesYouOwe = balances.filter(
    (balance) => getUserObjectId(balance.from) === currentUserId
  );
  const balancesOwedToYou = balances.filter(
    (balance) => getUserObjectId(balance.to) === currentUserId
  );
  const otherBalances = balances.filter((balance) => {
    const fromId = getUserObjectId(balance.from);
    const toId = getUserObjectId(balance.to);

    return fromId !== currentUserId && toId !== currentUserId;
  });

  const handleSettleBalance = (balance) => {
    setSettlementDraft({
      id: `${getUserObjectId(balance.from)}-${getUserObjectId(balance.to)}-${Date.now()}`,
      from: currentUserId,
      to: getUserObjectId(balance.to),
      amount: Number(balance.amount || 0).toFixed(2),
      note: "Settlement for shared expenses",
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10 lg:ml-72 lg:w-auto">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-600 mb-2">
              Group Summary
            </p>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900">
              {group.name}
            </h1>
            <p className="mt-2 text-slate-500">
              Review group totals, settlements, and netted balances.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              to="/groups"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-100"
            >
              Back to groups
            </Link>

            <button
              type="button"
              onClick={fetchSummary}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
          <SummaryCard label="Expenses" value={summary.expenseCount} />
          <SummaryCard label="Settlements" value={summary.settlementCount} />
          <SummaryCard
            label="Total Expenses"
            value={formatCurrency(summary.totalExpenses)}
            tone="text-rose-600"
          />
          <SummaryCard
            label="Total Settlements"
            value={formatCurrency(summary.totalSettlements)}
            tone="text-emerald-600"
          />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <SummaryCard
            label="You Owe"
            value={formatCurrency(summary.totalYouOwe)}
            tone="text-rose-600"
          />
          <SummaryCard
            label="You Are Owed"
            value={formatCurrency(summary.totalYouAreOwed)}
            tone="text-emerald-600"
          />
          <SummaryCard
            label="Net Balance"
            value={formatCurrency(summary.netBalance)}
            tone={getBalanceTone(summary.netBalance)}
          />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          <div className="xl:col-span-4 space-y-8">
            <GroupInvitationForm groupId={groupId} />

            {membersError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {membersError}
              </div>
            )}

            <SharedExpenseForm
              groupId={groupId}
              members={selectableMembers}
              onCreated={() => fetchSummary({ showLoading: false })}
            />

            <SettlementForm
              groupId={groupId}
              members={selectableMembers}
              settlementDraft={settlementDraft}
              onCreated={() => fetchSummary({ showLoading: false })}
            />

            {selectableMembers.length <= 1 && (
              <p className="mt-3 text-sm text-slate-500">
                More selectable members will appear here once balances include
                other group members.
              </p>
            )}
          </div>

          <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm xl:col-span-8">
            <div className="border-b border-slate-100 px-5 py-4 md:px-6">
              <h2 className="text-lg font-bold text-slate-900">
                Your Balance Breakdown
              </h2>
              <p className="text-sm text-slate-500">
                Understand what you owe, what is owed to you, and other group balances.
              </p>
            </div>

            <div className="space-y-6 p-5 md:p-6">
              {balances.length === 0 ? (
                <div className="py-10 text-center text-slate-500">
                  <p className="font-semibold text-slate-700">
                    No outstanding balances.
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Add a shared expense to start tracking who owes whom.
                  </p>
                </div>
              ) : (
                <>
                  <BalanceGroup
                    title="You owe"
                    emptyText="You do not owe anyone right now."
                    balances={balancesYouOwe}
                    currentUser={user}
                    actionLabel="Settle"
                    onAction={handleSettleBalance}
                  />

                  <BalanceGroup
                    title="You are owed"
                    emptyText="No one owes you right now."
                    balances={balancesOwedToYou}
                    currentUser={user}
                  />

                  <BalanceGroup
                    title="Other group balances"
                    emptyText="No other member balances right now."
                    balances={otherBalances}
                    currentUser={user}
                  />
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

const SummaryCard = ({ label, value, tone = "text-slate-900" }) => (
  <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100">
    <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
      {label}
    </p>
    <p className={`break-words text-2xl font-black md:text-3xl ${tone}`}>{value}</p>
  </div>
);

const BalanceGroup = ({
  title,
  emptyText,
  balances,
  currentUser,
  actionLabel,
  onAction,
}) => (
  <section>
    <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-400">
      {title}
    </h3>

    {balances.length === 0 ? (
      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-500">
        {emptyText}
      </div>
    ) : (
      <div className="space-y-3">
        {balances.map((balance) => (
          <div
            key={`${getUserObjectId(balance.from)}-${getUserObjectId(balance.to)}`}
            className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-words font-bold text-slate-900">
                  {getBalanceLabel(balance, currentUser)}
                </p>
                <p className="text-sm text-slate-500">
                  Balance after reverse netting and settlements.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:items-end">
                <p className="text-lg font-black text-slate-900">
                  {formatCurrency(balance.amount)}
                </p>
                {actionLabel && onAction && (
                  <button
                    type="button"
                    onClick={() => onAction(balance)}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 sm:w-auto"
                  >
                    {actionLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

export default GroupSummary;
