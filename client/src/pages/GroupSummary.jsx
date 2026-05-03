import { useCallback, useContext, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteGroup,
  getGroupExpenseHistory,
  getGroupMembers,
  getGroupSettlementHistory,
  getGroupSummary,
  updateGroup,
} from "../api/groups";
import GroupInvitationForm from "../components/GroupInvitationForm";
import GroupManageModal from "../components/GroupManageModal";
import Modal from "../components/Modal";
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

const groupTabs = ["summary", "expenses", "balances", "settlements", "members"];

const getEmptyListState = () => ({
  items: [],
  loading: false,
  error: "",
  loaded: false,
});

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

  return getUserDisplayName(value);
};

const getUserDisplayName = (value) => {
  if (value?.username) return `@${value.username}`;
  if (value?.name) return value.name;
  if (value?.email) return value.email;

  const valueId = getUserObjectId(value);
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

const formatDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString();
};

const getCurrentUserOption = (user) => {
  const userId = getUserId(user);

  if (!userId) {
    return null;
  }

  return {
    _id: userId,
    username: user?.username || "",
    name: user?.username || user?.name || "You",
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
        username: member?.username || "",
        name:
          member?.username ||
          member?.name ||
          member?.email ||
          `Member ${memberId.slice(-6)}`,
        email: member?.email || "",
      });
    }
  }

  return [...membersById.values()];
};

const getMembershipUser = (membership) => membership?.userId || membership?.user || null;

const getMemberName = (member) => {
  return getUserDisplayName(member);
};

const getHistoryUserLabel = (value) => {
  return getUserDisplayName(value);
};

const formatTitle = (value, fallback = "Shared expense") => {
  const title = String(value || fallback).trim();
  return title.charAt(0).toUpperCase() + title.slice(1);
};

const GroupSummary = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [groupSummary, setGroupSummary] = useState({
    group: null,
    summary: emptySummary,
    balances: [],
  });
  const [activeTab, setActiveTab] = useState("summary");
  const [activeMembers, setActiveMembers] = useState([]);
  const [activeMemberships, setActiveMemberships] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [membersError, setMembersError] = useState("");
  const [expenseHistory, setExpenseHistory] = useState(getEmptyListState);
  const [settlementHistory, setSettlementHistory] = useState(getEmptyListState);
  const [settlementDraft, setSettlementDraft] = useState(null);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [manageGroupModalOpen, setManageGroupModalOpen] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [groupActionMessage, setGroupActionMessage] = useState(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [activeAction, setActiveAction] = useState("expense");
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
        const nextActiveMemberships = Array.isArray(membersResult.value?.activeMembers)
          ? membersResult.value.activeMembers
          : [];
        const nextPendingInvites = Array.isArray(membersResult.value?.pendingInvites)
          ? membersResult.value.pendingInvites
          : [];

        setActiveMemberships(nextActiveMemberships);
        setPendingInvites(nextPendingInvites);
        setActiveMembers(
          getActiveMemberOptions(
            nextActiveMemberships,
            nextPendingInvites
          )
        );
        setMembersError("");
      } else {
        setActiveMembers([]);
        setActiveMemberships([]);
        setPendingInvites([]);
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

  const fetchExpenseHistory = useCallback(async () => {
    setExpenseHistory((prev) => ({ ...prev, loading: true, error: "" }));

    try {
      const data = await getGroupExpenseHistory(groupId);
      setExpenseHistory({
        items: Array.isArray(data?.expenses) ? data.expenses : [],
        loading: false,
        error: "",
        loaded: true,
      });
    } catch (fetchError) {
      setExpenseHistory({
        items: [],
        loading: false,
        error:
          fetchError.response?.data?.message ||
          "Failed to load shared expenses.",
        loaded: true,
      });
    }
  }, [groupId]);

  const fetchSettlementHistory = useCallback(async () => {
    setSettlementHistory((prev) => ({ ...prev, loading: true, error: "" }));

    try {
      const data = await getGroupSettlementHistory(groupId);
      setSettlementHistory({
        items: Array.isArray(data?.settlements) ? data.settlements : [],
        loading: false,
        error: "",
        loaded: true,
      });
    } catch (fetchError) {
      setSettlementHistory({
        items: [],
        loading: false,
        error:
          fetchError.response?.data?.message ||
          "Failed to load settlements.",
        loaded: true,
      });
    }
  }, [groupId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (activeTab === "expenses" && !expenseHistory.loaded && !expenseHistory.loading) {
      fetchExpenseHistory();
    }

    if (
      activeTab === "settlements" &&
      !settlementHistory.loaded &&
      !settlementHistory.loading
    ) {
      fetchSettlementHistory();
    }
  }, [
    activeTab,
    expenseHistory.loaded,
    expenseHistory.loading,
    fetchExpenseHistory,
    fetchSettlementHistory,
    settlementHistory.loaded,
    settlementHistory.loading,
  ]);

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
  const activeMemberCount = activeMemberships.filter(
    (membership) => membership?.status === "active"
  ).length;
  const isCurrentUserOwner = activeMemberships.some(
    (membership) =>
      membership?.role === "owner" &&
      getUserObjectId(getMembershipUser(membership)) === currentUserId
  );
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
    setActiveAction("settlement");
    setSettlementDraft({
      id: `${getUserObjectId(balance.from)}-${getUserObjectId(balance.to)}-${Date.now()}`,
      from: currentUserId,
      to: getUserObjectId(balance.to),
      amount: Number(balance.amount || 0).toFixed(2),
      note: "Settlement for shared expenses",
    });
    setSettlementModalOpen(true);
  };

  const handleSharedExpenseCreated = async () => {
    await fetchSummary({ showLoading: false });

    if (expenseHistory.loaded) {
      await fetchExpenseHistory();
    }

    setExpenseModalOpen(false);
  };

  const handleSettlementCreated = async () => {
    await fetchSummary({ showLoading: false });

    if (settlementHistory.loaded) {
      await fetchSettlementHistory();
    }

    setSettlementModalOpen(false);
    setSettlementDraft(null);
  };

  const openManageGroup = () => {
    setGroupNameDraft(group.name || "");
    setGroupActionMessage(null);
    setManageGroupModalOpen(true);
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
      const updatedGroup = await updateGroup(groupId, { name: nextName });
      setGroupSummary((prev) => ({
        ...prev,
        group: updatedGroup || { ...prev.group, name: nextName },
      }));
      setManageGroupModalOpen(false);
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
      await deleteGroup(groupId);
      navigate("/groups");
    } catch (actionError) {
      setGroupActionMessage({
        type: "error",
        text: actionError.response?.data?.message || "Failed to delete group.",
      });
      setDeletingGroup(false);
    }
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
              {activeMemberCount || selectableMembers.length} member
              {(activeMemberCount || selectableMembers.length) === 1 ? "" : "s"}
              {isCurrentUserOwner ? " - You own this group" : " - Shared money workspace"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap md:justify-end">
            {isCurrentUserOwner && (
              <button
                type="button"
                onClick={openManageGroup}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-100"
              >
                Manage
              </button>
            )}

            <button
              type="button"
              onClick={fetchSummary}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
            >
              Refresh
            </button>

            <Link
              to="/groups"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-white hover:text-slate-800"
            >
              Back to groups
            </Link>
          </div>
        </header>

        <section className="mb-8 rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <GroupActionCard
              title="Add Expense"
              description="Split a cost between members"
              active={activeAction === "expense"}
              onClick={() => {
                setActiveAction("expense");
                setExpenseModalOpen(true);
              }}
            />
            <GroupActionCard
              title="Record Settlement"
              description="Mark money as paid back"
              active={activeAction === "settlement"}
              onClick={() => {
                setActiveAction("settlement");
                setSettlementDraft(null);
                setSettlementModalOpen(true);
              }}
            />
            <GroupActionCard
              title="Invite Member"
              description="Add someone to this group"
              active={activeAction === "invite"}
              onClick={() => {
                setActiveAction("invite");
                setInviteModalOpen(true);
              }}
            />
          </div>
        </section>

        {membersError && (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {membersError}
          </div>
        )}

        {selectableMembers.length <= 1 && (
          <p className="mb-8 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            More selectable members will appear here once active group members
            accept invitations.
          </p>
        )}

        <GroupTabNav activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "summary" && (
          <SummaryTab summary={summary} onOpenBalances={() => setActiveTab("balances")} />
        )}

        {activeTab === "expenses" && (
          <ExpensesTab
            expenseHistory={expenseHistory}
            onRefresh={fetchExpenseHistory}
            onAddExpense={() => setExpenseModalOpen(true)}
          />
        )}

        {activeTab === "balances" && (
          <BalancesTab
            balances={balances}
            balancesYouOwe={balancesYouOwe}
            balancesOwedToYou={balancesOwedToYou}
            otherBalances={otherBalances}
            currentUser={user}
            summary={summary}
            onAddExpense={() => setExpenseModalOpen(true)}
            onSettle={handleSettleBalance}
          />
        )}

        {activeTab === "settlements" && (
          <SettlementsTab
            settlementHistory={settlementHistory}
            onRefresh={fetchSettlementHistory}
            onRecordSettlement={() => {
              setSettlementDraft(null);
              setSettlementModalOpen(true);
            }}
          />
        )}

        {activeTab === "members" && (
          <MembersTab
            activeMemberships={activeMemberships}
            pendingInvites={pendingInvites}
            membersError={membersError}
            onInviteMember={() => setInviteModalOpen(true)}
          />
        )}

        <Modal
          open={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
          title="Invite Member"
          description="Invite existing Munmai users by email."
        >
          <GroupInvitationForm groupId={groupId} />
        </Modal>

        <GroupManageModal
          open={manageGroupModalOpen}
          onClose={() => setManageGroupModalOpen(false)}
          group={group}
          groupNameDraft={groupNameDraft}
          onGroupNameDraftChange={setGroupNameDraft}
          onRename={handleUpdateGroup}
          onDelete={handleDeleteGroup}
          saving={savingGroup}
          deleting={deletingGroup}
          message={groupActionMessage}
        />

        <Modal
          open={expenseModalOpen}
          onClose={() => setExpenseModalOpen(false)}
          title="Add Shared Expense"
          description="Create an equal split for active group members."
        >
          <SharedExpenseForm
            groupId={groupId}
            members={selectableMembers}
            onCreated={handleSharedExpenseCreated}
          />
        </Modal>

        <Modal
          open={settlementModalOpen}
          onClose={() => setSettlementModalOpen(false)}
          title="Record Settlement"
          description="Log a payment between group members."
        >
          <SettlementForm
            groupId={groupId}
            members={selectableMembers}
            settlementDraft={settlementDraft}
            onCreated={handleSettlementCreated}
          />
        </Modal>
      </main>
    </div>
  );
};

const GroupTabNav = ({ activeTab, onChange }) => (
  <div className="mb-6 overflow-x-auto rounded-full border border-slate-100 bg-white p-1.5 shadow-sm">
    <div className="flex min-w-max gap-1.5">
      {groupTabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`rounded-full px-4 py-2.5 text-sm font-black capitalize transition ${
            activeTab === tab
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  </div>
);

const GroupActionCard = ({ title, description, onClick, active = false }) => (
  <button
    type="button"
    onClick={onClick}
    className={`min-h-28 rounded-2xl px-5 py-4 text-left transition ${
      active
        ? "bg-slate-900 text-white shadow-sm hover:bg-slate-800"
        : "border border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
    }`}
  >
    <span className="block text-base font-black">{title}</span>
    <span
      className={`mt-2 block text-sm ${
        active ? "text-slate-300" : "text-slate-500"
      }`}
    >
      {description}
    </span>
  </button>
);

const SummaryTab = ({ summary, onOpenBalances }) => (
  <section className="space-y-6">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Expenses" value={summary.expenseCount} />
      <SummaryCard label="Settlements" value={summary.settlementCount} />
      <SummaryCard
        label="Total Expenses"
        value={formatCurrency(summary.totalExpenses)}
        tone="text-rose-600"
      />
      <SummaryCard
        label="Net Balance"
        value={formatCurrency(summary.netBalance)}
        tone={getBalanceTone(summary.netBalance)}
      />
    </div>

    <PanelShell
      title="Shared Money Overview"
      description="A quick view of how this group currently affects you."
      action={
        <button
          type="button"
          onClick={onOpenBalances}
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 sm:w-auto"
        >
          View Balances
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-3 md:p-6">
        <BalanceTotal
          label="You owe"
          value={summary.totalYouOwe}
          tone="text-rose-600"
        />
        <BalanceTotal
          label="You are owed"
          value={summary.totalYouAreOwed}
          tone="text-emerald-600"
        />
        <BalanceTotal
          label="Total settlements"
          value={summary.totalSettlements}
          tone="text-slate-900"
        />
      </div>
    </PanelShell>
  </section>
);

const ExpensesTab = ({ expenseHistory, onRefresh, onAddExpense }) => (
  <PanelShell
    title="Shared Expenses"
    description="All shared expenses recorded for this group, newest first."
    action={
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 sm:w-auto"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={onAddExpense}
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 sm:w-auto"
        >
          Add Expense
        </button>
      </div>
    }
  >
    {expenseHistory.loading ? (
      <EmptyPanel title="Loading shared expenses..." />
    ) : expenseHistory.error ? (
      <EmptyPanel title={expenseHistory.error} tone="error" />
    ) : expenseHistory.items.length === 0 ? (
      <EmptyPanel
        title="No expenses yet"
        description="Start by adding your first shared expense."
        actionLabel="Add Expense"
        onAction={onAddExpense}
      />
    ) : (
      <div className="space-y-4 bg-slate-50/50 p-4 md:p-5">
        {expenseHistory.items.map((expense) => (
          <div
            key={expense._id}
            className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="break-words text-lg font-black text-slate-900">
                  {formatTitle(expense.description)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Paid by {getHistoryUserLabel(expense.paidBy)} -{" "}
                  {formatDate(expense.createdAt)}
                </p>
              </div>
              <p className="text-lg font-black text-slate-900">
                {formatCurrency(expense.amount)}
              </p>
            </div>

            {Array.isArray(expense.splits) && expense.splits.length > 0 && (
              <div className="mt-5 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                {expense.splits.map((split) => (
                  <div
                    key={split._id}
                    className="flex items-center justify-between gap-4 rounded-xl bg-white px-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0 break-words font-semibold text-slate-800">
                      {getHistoryUserLabel(split.user)} -&gt;
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(split.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </PanelShell>
);

const BalancesTab = ({
  balances,
  balancesYouOwe,
  balancesOwedToYou,
  otherBalances,
  currentUser,
  summary,
  onAddExpense,
  onSettle,
}) => (
  <PanelShell
    title="Balances"
    description="Netted balances after shared expenses and settlements."
  >
    <div className="border-b border-slate-100 px-5 py-4 md:px-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <BalanceTotal
          label="You owe"
          value={summary.totalYouOwe}
          tone="text-rose-600"
        />
        <BalanceTotal
          label="You are owed"
          value={summary.totalYouAreOwed}
          tone="text-emerald-600"
        />
        <BalanceTotal
          label="Net balance"
          value={summary.netBalance}
          tone={getBalanceTone(summary.netBalance)}
        />
      </div>
    </div>

    <div className="space-y-6 p-5 md:p-6">
      {balances.length === 0 ? (
        <EmptyPanel
          title="No balances yet"
          description="Add a shared expense to see who owes whom."
          actionLabel="Add Expense"
          onAction={onAddExpense}
        />
      ) : (
        <>
          <BalanceGroup
            title="You owe"
            emptyText="You do not owe anyone right now."
            balances={balancesYouOwe}
            currentUser={currentUser}
            actionLabel="Settle"
            onAction={onSettle}
          />

          <BalanceGroup
            title="You are owed"
            emptyText="No one owes you right now."
            balances={balancesOwedToYou}
            currentUser={currentUser}
          />

          <BalanceGroup
            title="Other group balances"
            emptyText="No other member balances right now."
            balances={otherBalances}
            currentUser={currentUser}
          />
        </>
      )}
    </div>
  </PanelShell>
);

const SettlementsTab = ({ settlementHistory, onRefresh, onRecordSettlement }) => (
  <PanelShell
    title="Settlements"
    description="Payments recorded between group members, newest first."
    action={
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 sm:w-auto"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={onRecordSettlement}
          className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 sm:w-auto"
        >
          Record Settlement
        </button>
      </div>
    }
  >
    {settlementHistory.loading ? (
      <EmptyPanel title="Loading settlements..." />
    ) : settlementHistory.error ? (
      <EmptyPanel title={settlementHistory.error} tone="error" />
    ) : settlementHistory.items.length === 0 ? (
      <EmptyPanel
        title="No settlements yet"
        description="Record a payment when someone pays another member back."
        actionLabel="Record Settlement"
        onAction={onRecordSettlement}
      />
    ) : (
      <div className="divide-y divide-slate-100">
        {settlementHistory.items.map((settlement) => (
          <div
            key={settlement._id}
            className="px-5 py-4 md:px-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
          >
            <div className="min-w-0">
              <p className="break-words font-bold text-slate-900">
                {getHistoryUserLabel(settlement.from)} paid{" "}
                {getHistoryUserLabel(settlement.to)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {settlement.note || "No note"}
              </p>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                {formatDate(settlement.createdAt)}
              </p>
            </div>
            <p className="text-lg font-black text-emerald-600">
              {formatCurrency(settlement.amount)}
            </p>
          </div>
        ))}
      </div>
    )}
  </PanelShell>
);

const MembersTab = ({
  activeMemberships,
  pendingInvites,
  membersError,
  onInviteMember,
}) => (
  <PanelShell
    title="Members"
    description="Active members can participate in shared expenses and settlements."
    action={
      <button
        type="button"
        onClick={onInviteMember}
        className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 sm:w-auto"
      >
        Invite Member
      </button>
    }
  >
    {membersError ? (
      <EmptyPanel title={membersError} tone="warning" />
    ) : activeMemberships.length === 0 ? (
      <EmptyPanel
        title="No members yet"
        description="Invite friends to start tracking together."
        actionLabel="Invite Member"
        onAction={onInviteMember}
      />
    ) : (
      <div className="space-y-6 p-5 md:p-6">
        <MemberList title="Active members" memberships={activeMemberships} />
        <MemberList title="Pending invites" memberships={pendingInvites} />
      </div>
    )}
  </PanelShell>
);

const MemberList = ({ title, memberships }) => (
  <section>
    <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-400">
      {title}
    </h3>
    {memberships.length === 0 ? (
      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-500">
        None right now.
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {memberships.map((membership) => {
          const member = getMembershipUser(membership);
          const memberId = getUserObjectId(member) || membership._id;

          return (
            <div
              key={membership._id || memberId}
              className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-bold text-slate-900">
                    {getMemberName(member)}
                  </p>
                  {!member?.username && !member?.name && member?.email && (
                    <p className="break-words text-sm text-slate-500">
                      {member.email}
                    </p>
                  )}
                  {!member?.username &&
                    !member?.name &&
                    !member?.email &&
                    membership?.invitedEmail && (
                    <p className="break-words text-sm text-slate-500">
                      {membership.invitedEmail}
                    </p>
                  )}
                </div>
                <StatusPill status={membership.status} />
              </div>
            </div>
          );
        })}
      </div>
    )}
  </section>
);

const PanelShell = ({ title, description, action, children }) => (
  <section className="min-w-0 overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 px-5 py-5 md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">{title}</h2>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
    </div>
    {children}
  </section>
);

const EmptyPanel = ({ title, description, tone = "default", actionLabel, onAction }) => (
  <div
    className={`p-8 text-center md:p-10 ${
      tone === "error"
        ? "text-rose-700"
        : tone === "warning"
        ? "text-amber-700"
        : "text-slate-500"
    }`}
  >
    <p className="text-lg font-black">{title}</p>
    {description && <p className="mx-auto mt-2 max-w-md text-sm">{description}</p>}
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-5 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

const StatusPill = ({ status }) => (
  <span
    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-widest ${
      status === "active"
        ? "bg-emerald-50 text-emerald-700"
        : status === "pending"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-600"
    }`}
  >
    {status || "member"}
  </span>
);

const SummaryCard = ({ label, value, tone = "text-slate-900" }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-5">
    <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
      {label}
    </p>
    <p className={`break-words text-xl font-black md:text-2xl ${tone}`}>{value}</p>
  </div>
);

const BalanceTotal = ({ label, value, tone }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
    <p className="text-xs font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className={`mt-1 break-words text-lg font-black ${tone}`}>
      {formatCurrency(value)}
    </p>
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
