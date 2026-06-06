import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import api from "../api/axios";
import { getBudgetSummary, updateBudgetLimit } from "../api/budget";
import { getDashboardSummary } from "../api/dashboard";
import { getLiabilitySummary } from "../api/liabilities";
import { getOpeningBalance } from "../api/openingBalance";
import Modal from "../components/Modal";
import Sidebar from "../components/Sidebar";
import { AuthContext } from "../context/authContext";

const CURRENT_MONTH = new Date().getMonth();
const CURRENT_YEAR = new Date().getFullYear();

const COLORS = [
  "#4F46E5",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#64748B",
];

const MONTH_OPTIONS = [
  { value: 0, label: "January" },
  { value: 1, label: "February" },
  { value: 2, label: "March" },
  { value: 3, label: "April" },
  { value: 4, label: "May" },
  { value: 5, label: "June" },
  { value: 6, label: "July" },
  { value: 7, label: "August" },
  { value: 8, label: "September" },
  { value: 9, label: "October" },
  { value: 10, label: "November" },
  { value: 11, label: "December" },
];

const buildEmptyDashboardSummary = () => ({
  incomeTotal: 0,
  expenseTotal: 0,
  balance: 0,
  categoryBreakdown: [],
  sharedMoney: {
    totalYouOwe: 0,
    totalYouAreOwed: 0,
    netBalance: 0,
  },
});

const buildEmptyBudgetSummary = () => ({
  monthlySpendingLimit: 0,
  month: CURRENT_MONTH + 1,
  year: CURRENT_YEAR,
  spentThisMonth: 0,
  remaining: 0,
  percentUsed: 0,
  daysRemainingInMonth: 0,
  dailySafeSpend: null,
  status: "no_budget",
  topCategory: null,
});

const buildEmptyDebtRealitySummary = () => ({
  totalActiveDebt: 0,
  monthlyDebtPressure: 0,
  dueSoonCount: 0,
});

const buildEmptyOpeningBalance = () => ({
  amount: 0,
  asOfDate: null,
  notes: "",
});

const budgetStatusLabels = {
  no_budget: "No budget",
  safe: "Safe",
  warning: "Warning",
  over: "Over budget",
};

const budgetInsights = {
  no_budget: "Set a monthly spending limit to start tracking your spending pace.",
  safe: "You are within your monthly spending limit.",
  warning: "You are close to your monthly spending limit. Slow down to stay on track.",
  over: "You are over your monthly spending limit. Review non-essential spending.",
};

const quickActions = [
  {
    title: "Add Income",
    description: "Record money coming in.",
    to: "/money/transactions?type=income#add-transaction",
  },
  {
    title: "Add Expense",
    description: "Track spending quickly.",
    to: "/money/transactions?type=expense#add-transaction",
  },
  {
    title: "View Transactions",
    description: "Search, edit, and manage daily money movement.",
    to: "/money/transactions",
  },
  {
    title: "Receipt Inbox",
    description: "Upload and organize receipt documents.",
    to: "/money/receipts",
  },
  {
    title: "Import Statements",
    description: "Review CSV or PDF bank statement rows.",
    to: "/imports",
  },
  {
    title: "Monthly Summary",
    description: "Review income, expenses, and monthly trends.",
    to: "/monthly-summary",
  },
  {
    title: "Debt Reality",
    description: "Track debts, due dates, and payment pressure.",
    to: "/debt-reality",
  },
  {
    title: "Tax Pack",
    description: "Review deductible expenses and export CSV.",
    to: "/money/tax-pack",
  },
];

const getStartedItems = [
  {
    key: "transaction",
    label: "Add your first transaction",
    to: "/money/transactions#add-transaction",
    cta: "Add transaction",
  },
  {
    key: "group",
    label: "Create or join a group",
    to: "/groups",
    cta: "Create/join group",
  },
  {
    key: "sharedExpense",
    label: "Add a shared expense",
    to: "/groups",
    cta: "Add shared expense",
  },
  {
    key: "receipt",
    label: "Upload or attach a receipt",
    to: "/money/receipts",
    cta: "Upload receipt",
  },
];

const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(value || 0));

const normalizeTransaction = (item, type) => {
  const isIncome = type === "income";
  const cleanRecipient = item.recipient?.trim();

  return {
    ...item,
    transactionType: type,
    isIncome,
    displayTitle: isIncome
      ? item.source || item.category || "Income"
      : cleanRecipient || item.category || "Expense",
    displaySubLabel: isIncome
      ? item.category || "Income"
      : item.category || "Expense",
    displaySubtitle: item.notes || "",
  };
};

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState({ income: [], expenses: [] });
  const [groups, setGroups] = useState([]);
  const [dashboardSummary, setDashboardSummary] = useState(
    buildEmptyDashboardSummary
  );
  const [budgetSummary, setBudgetSummary] = useState(buildEmptyBudgetSummary);
  const [debtRealitySummary, setDebtRealitySummary] = useState(
    buildEmptyDebtRealitySummary
  );
  const [openingBalance, setOpeningBalance] = useState(buildEmptyOpeningBalance);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetLimitDraft, setBudgetLimitDraft] = useState("");
  const [budgetMessage, setBudgetMessage] = useState(null);
  const [savingBudget, setSavingBudget] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [transactionError, setTransactionError] = useState("");
  const [groupError, setGroupError] = useState("");
  const [budgetError, setBudgetError] = useState("");
  const [debtRealityError, setDebtRealityError] = useState("");
  const [openingBalanceError, setOpeningBalanceError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);

  const displayName =
    user?.username ||
    user?.name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "User";

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, index) => current - index);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);

    const [
      summaryResult,
      incomeResult,
      expenseResult,
      groupResult,
      budgetResult,
      debtRealityResult,
      openingBalanceResult,
    ] =
      await Promise.allSettled([
        getDashboardSummary(),
        api.get("/income"),
        api.get("/expenses"),
        api.get("/groups"),
        getBudgetSummary(),
        getLiabilitySummary(),
        getOpeningBalance(),
      ]);

    if (summaryResult.status === "fulfilled") {
      setDashboardSummary({
        ...buildEmptyDashboardSummary(),
        ...(summaryResult.value || {}),
        sharedMoney: {
          ...buildEmptyDashboardSummary().sharedMoney,
          ...(summaryResult.value?.sharedMoney || {}),
        },
      });
      setDashboardError("");
    } else {
      setDashboardSummary(buildEmptyDashboardSummary());
      setDashboardError(
        summaryResult.reason?.response?.data?.message ||
          "Failed to load dashboard summary."
      );
    }

    if (incomeResult.status === "fulfilled" && expenseResult.status === "fulfilled") {
      setData({
        income: incomeResult.value.data || [],
        expenses: expenseResult.value.data || [],
      });
      setTransactionError("");
    } else {
      setData({ income: [], expenses: [] });
      setTransactionError("Failed to load transaction preview.");
    }

    if (groupResult.status === "fulfilled") {
      setGroups(Array.isArray(groupResult.value.data) ? groupResult.value.data : []);
      setGroupError("");
    } else {
      setGroups([]);
      setGroupError("Failed to load group preview.");
    }

    if (budgetResult.status === "fulfilled") {
      setBudgetSummary({
        ...buildEmptyBudgetSummary(),
        ...(budgetResult.value || {}),
      });
      setBudgetError("");
    } else {
      setBudgetSummary(buildEmptyBudgetSummary());
      setBudgetError(
        budgetResult.reason?.response?.data?.message ||
          "Failed to load monthly control."
      );
    }

    if (debtRealityResult.status === "fulfilled") {
      setDebtRealitySummary({
        ...buildEmptyDebtRealitySummary(),
        ...(debtRealityResult.value || {}),
      });
      setDebtRealityError("");
    } else {
      setDebtRealitySummary(buildEmptyDebtRealitySummary());
      setDebtRealityError(
        debtRealityResult.reason?.response?.data?.message ||
        "Failed to load Debt Reality."
      );
    }

    if (openingBalanceResult.status === "fulfilled") {
      setOpeningBalance({
        ...buildEmptyOpeningBalance(),
        ...(openingBalanceResult.value?.openingBalance || {}),
      });
      setOpeningBalanceError("");
    } else {
      setOpeningBalance(buildEmptyOpeningBalance());
      setOpeningBalanceError(
        openingBalanceResult.reason?.response?.data?.message ||
          "Failed to load opening balance."
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const stats = useMemo(() => {
    const normalizedIncome = data.income.map((item) =>
      normalizeTransaction(item, "income")
    );
    const normalizedExpenses = data.expenses.map((item) =>
      normalizeTransaction(item, "expense")
    );

    const allTransactions = [...normalizedIncome, ...normalizedExpenses].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    const periodIncome = normalizedIncome.filter((item) => {
      const itemDate = new Date(item.date);
      return (
        itemDate.getMonth() === selectedMonth &&
        itemDate.getFullYear() === selectedYear
      );
    });

    const periodExpenses = normalizedExpenses.filter((item) => {
      const itemDate = new Date(item.date);
      return (
        itemDate.getMonth() === selectedMonth &&
        itemDate.getFullYear() === selectedYear
      );
    });

    const periodIncomeTotal = periodIncome.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const periodExpenseTotal = periodExpenses.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const expenseCategoryMap = periodExpenses.reduce((accumulator, expense) => {
      const category = expense.category || "Other";
      accumulator[category] =
        (accumulator[category] || 0) + Number(expense.amount || 0);
      return accumulator;
    }, {});

    const chart = Object.entries(expenseCategoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const periodLabel = new Date(selectedYear, selectedMonth, 1).toLocaleString(
      "default",
      { month: "long", year: "numeric" }
    );

    return {
      allTransactions,
      recentTransactions: allTransactions.slice(0, 5),
      periodIncomeTotal,
      periodExpenseTotal,
      periodBalance: periodIncomeTotal - periodExpenseTotal,
      chart,
      periodLabel,
    };
  }, [data, selectedMonth, selectedYear]);

  const openBudgetModal = () => {
    setBudgetLimitDraft(
      budgetSummary.monthlySpendingLimit > 0
        ? String(budgetSummary.monthlySpendingLimit)
        : ""
    );
    setBudgetMessage(null);
    setBudgetModalOpen(true);
  };

  const handleBudgetSubmit = async (event) => {
    event.preventDefault();

    if (budgetLimitDraft === "") {
      setBudgetMessage({
        type: "error",
        text: "Monthly spending limit is required.",
      });
      return;
    }

    const nextLimit = Number(budgetLimitDraft);

    if (!Number.isFinite(nextLimit) || nextLimit < 0) {
      setBudgetMessage({
        type: "error",
        text: "Monthly spending limit must be greater than or equal to 0.",
      });
      return;
    }

    try {
      setSavingBudget(true);
      setBudgetMessage(null);
      const nextBudgetSummary = await updateBudgetLimit(nextLimit);
      setBudgetSummary({
        ...buildEmptyBudgetSummary(),
        ...(nextBudgetSummary || {}),
      });
      setBudgetError("");
      setBudgetMessage({
        type: "success",
        text: "Monthly spending limit saved.",
      });
    } catch (error) {
      setBudgetMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to save budget.",
      });
    } finally {
      setSavingBudget(false);
    }
  };

  const sharedMoney =
    dashboardSummary.sharedMoney ?? buildEmptyDashboardSummary().sharedMoney;
  const personalBalance =
    Number(openingBalance.amount || 0) + Number(dashboardSummary.balance || 0);
  const hasAnyTransactions = stats.allTransactions.length > 0;
  const hasAnyGroups = groups.length > 0;
  const showOnboarding = !hasAnyTransactions && !hasAnyGroups && !groupError;
  const hasSharedExpenseActivity =
    Number(sharedMoney.totalYouOwe || 0) !== 0 ||
    Number(sharedMoney.totalYouAreOwed || 0) !== 0 ||
    Number(sharedMoney.netBalance || 0) !== 0;
  const hasAnyReceipt = data.expenses.some((expense) =>
    Boolean(String(expense?.receiptUrl || expense?.receipt || "").trim())
  );
  const checklistCompletion = {
    transaction: hasAnyTransactions,
    group: hasAnyGroups,
    sharedExpense: hasSharedExpenseActivity,
    receipt: hasAnyReceipt,
  };
  const completedChecklistCount = Object.values(checklistCompletion).filter(Boolean).length;
  const showChecklist = completedChecklistCount < getStartedItems.length;

  if (loading && !hasAnyTransactions) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex min-h-screen items-center justify-center px-4 font-bold text-slate-400 lg:ml-72">
          Syncing Munmai OS...
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 antialiased">
      <Sidebar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10 lg:ml-72 lg:w-auto">
        <header className="mb-8 md:mb-10">
          <p className="mb-2 text-sm font-semibold text-indigo-600">
            {getGreeting()}, {displayName}
          </p>
          <h1 className="text-3xl font-black text-slate-900 md:text-4xl">Overview</h1>
          <p className="font-medium text-slate-500">
            {hasAnyTransactions
              ? `Tracking ${stats.allTransactions.length} transactions across your account.`
              : "No account activity yet. Add your first income or expense to begin tracking."}
          </p>
        </header>

        {(dashboardError ||
          transactionError ||
          groupError ||
          budgetError ||
          debtRealityError ||
          openingBalanceError) && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            {dashboardError ||
              transactionError ||
              groupError ||
              budgetError ||
              debtRealityError ||
              openingBalanceError}
          </div>
        )}

        {showOnboarding && (
          <section className="mb-10 rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Welcome to Munmai
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Start tracking your money in seconds.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/money/transactions#add-transaction"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 sm:w-auto"
                >
                  Add Transaction
                </Link>
                <Link
                  to="/groups"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 sm:w-auto"
                >
                  Create Group
                </Link>
              </div>
            </div>
          </section>
        )}

        {!hasAnyTransactions && !showOnboarding && (
          <section className="mb-10 rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Start by adding your first transaction.
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Add income or expenses to unlock your monthly overview,
                  spending chart, receipts, and Tax Pack.
                </p>
              </div>

              <Link
                to="/money/transactions#add-transaction"
                className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 sm:w-auto"
              >
                Add Transaction
              </Link>
            </div>
          </section>
        )}

        {showChecklist && (
          <GetStartedChecklist
            completion={checklistCompletion}
            completedCount={completedChecklistCount}
          />
        )}

        <SectionHeading
          title="Overview"
          description="Your all-time personal totals and shared money position."
        />
        <section className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Net Balance" value={personalBalance} isBalance />
          <MetricCard label="Income Total" value={dashboardSummary.incomeTotal} type="income" />
          <MetricCard label="Expense Total" value={dashboardSummary.expenseTotal} type="expense" />
          <MetricCard label="Shared Net Balance" value={sharedMoney.netBalance} isBalance />
        </section>

        <SectionHeading
          title="Monthly Control"
          description="Track this month against a simple spending limit."
        />
        <section className="mb-10">
          <MonthlyControlCard budget={budgetSummary} onSetBudget={openBudgetModal} />
        </section>

        <SectionHeading
          title="Debt Reality"
          description="Understand what you owe and your monthly debt pressure."
          action={
            <Link
              to="/debt-reality"
              className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 sm:w-auto"
            >
              View Debt Reality
            </Link>
          }
        />
        <section className="mb-10">
          <DebtRealityCard summary={debtRealitySummary} />
        </section>

        <SectionHeading
          title="Quick Actions"
          description="Jump straight into the most common money tasks."
        />
        <section className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <QuickActionCard key={action.title} action={action} />
          ))}
        </section>

        <SectionHeading
          title="Shared Money"
          description="Your current shared balance across active groups."
          action={
            <Link
              to="/groups"
              className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 sm:w-auto"
            >
              View Groups
            </Link>
          }
        />
        <section className="mb-10 grid grid-cols-1 gap-5 md:grid-cols-2">
          <MiniMoneyCard label="You owe" value={sharedMoney.totalYouOwe} tone="text-rose-600" />
          <MiniMoneyCard label="You are owed" value={sharedMoney.totalYouAreOwed} tone="text-emerald-600" />
        </section>

        <SectionHeading
          title="Monthly Snapshot"
          description="Choose a month to inspect income, expenses, and category mix."
        />
        <section className="mb-10 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
                Active Period
              </p>
              <h2 className="text-2xl font-black text-slate-900">
                {stats.periodLabel}
              </h2>
              <p className="text-sm text-slate-500">
                Snapshot cards and spending breakdown reflect this selected period.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(Number(event.target.value))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                {MONTH_OPTIONS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={fetchDashboardData}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
              >
                Refresh
              </button>
            </div>
          </div>
        </section>

        <section className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <MetricCard label={`${stats.periodLabel} Income`} value={stats.periodIncomeTotal} type="income" />
          <MetricCard label={`${stats.periodLabel} Expense`} value={stats.periodExpenseTotal} type="expense" />
          <MetricCard label={`${stats.periodLabel} Balance`} value={stats.periodBalance} isBalance />
        </section>

        <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6 lg:col-span-5">
            <h2 className="mb-2 text-lg font-bold text-slate-900">
              Spending Breakdown
            </h2>
            <p className="mb-4 text-sm text-slate-500">{stats.periodLabel}</p>

            <div className="h-[340px]">
              {stats.chart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.chart}
                      cx="50%"
                      cy="50%"
                      dataKey="value"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={5}
                    >
                      {stats.chart.map((_, index) => (
                        <Cell
                          key={index}
                          fill={COLORS[index % COLORS.length]}
                          strokeWidth={0}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ border: "none", borderRadius: "12px" }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: "12px", fontWeight: "bold" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-center font-medium italic text-slate-400">
                  {hasAnyTransactions
                    ? `No expense data to visualize for ${stats.periodLabel}.`
                    : "Add your first expense to unlock category insights."}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm lg:col-span-7">
            <div className="border-b border-slate-100 px-5 py-4 md:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Recent Transactions
                  </h2>
                  <p className="text-sm text-slate-500">
                    Latest 5 income and expense entries.
                  </p>
                </div>

                <Link
                  to="/money/transactions"
                  className="text-sm font-bold text-indigo-600 hover:underline"
                >
                  View all
                </Link>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="px-6 py-10 text-center font-medium text-slate-400">
                  Refreshing data...
                </div>
              ) : stats.recentTransactions.length === 0 ? (
                <div className="px-6 py-10 text-center text-slate-500">
                  No transactions yet.
                </div>
              ) : (
                stats.recentTransactions.map((item) => (
                  <RecentTransactionRow
                    key={`${item.transactionType}-${item._id}`}
                    item={item}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        <Modal
          open={budgetModalOpen}
          onClose={() => setBudgetModalOpen(false)}
          title="Set Spending Limit"
          description="Set a monthly spending limit for personal expenses."
        >
          <form onSubmit={handleBudgetSubmit} className="space-y-4">
            {budgetMessage?.text && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                  budgetMessage.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {budgetMessage.text}
              </div>
            )}

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Monthly spending limit
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={budgetLimitDraft}
                onChange={(event) => setBudgetLimitDraft(event.target.value)}
                disabled={savingBudget}
                placeholder="1200"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
              />
            </label>

            <button
              type="submit"
              disabled={savingBudget}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300"
            >
              {savingBudget ? "Saving..." : "Save Spending Limit"}
            </button>
          </form>
        </Modal>
      </main>
    </div>
  );
};

const MetricCard = ({ label, value, type, isBalance }) => (
  <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
    <p
      className={`mb-2 text-xs font-bold uppercase tracking-widest ${
        type === "income"
          ? "text-emerald-500"
          : type === "expense"
          ? "text-rose-500"
          : "text-slate-400"
      }`}
    >
      {label}
    </p>
    <p
      className={`break-words text-2xl font-black sm:text-3xl ${
        isBalance
          ? Number(value || 0) >= 0
            ? "text-slate-900"
            : "text-rose-600"
          : type === "income"
          ? "text-emerald-600"
          : "text-rose-600"
      }`}
    >
      {formatCurrency(value)}
    </p>
  </div>
);

const SectionHeading = ({ title, description, action }) => (
  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h2 className="text-xl font-black text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
    {action}
  </div>
);

const QuickActionCard = ({ action }) => (
  <Link
    to={action.to}
    className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-100 hover:shadow-md"
  >
    <p className="font-black text-slate-900">{action.title}</p>
    <p className="mt-2 text-sm text-slate-500">{action.description}</p>
  </Link>
);

const MiniMoneyCard = ({ label, value, tone }) => (
  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className={`text-2xl font-black ${tone}`}>{formatCurrency(value)}</p>
  </div>
);

const getBudgetStatusTone = (status) => {
  if (status === "safe") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  }

  if (status === "warning") {
    return "bg-amber-50 text-amber-700 ring-amber-100";
  }

  if (status === "over") {
    return "bg-rose-50 text-rose-700 ring-rose-100";
  }

  return "bg-slate-100 text-slate-600 ring-slate-200";
};

const getBudgetProgressTone = (status) => {
  if (status === "safe") {
    return "bg-emerald-500";
  }

  if (status === "warning") {
    return "bg-amber-500";
  }

  if (status === "over") {
    return "bg-rose-500";
  }

  return "bg-slate-300";
};

const MonthlyControlCard = ({ budget, onSetBudget }) => {
  const hasBudget = Number(budget.monthlySpendingLimit || 0) > 0;
  const status = budget.status || "no_budget";
  const percentUsed = Number(budget.percentUsed || 0);
  const progressPercent = Math.min(Math.max(percentUsed, 0), 100);
  const remaining = Number(budget.remaining || 0);
  const dailySafeSpend =
    budget.dailySafeSpend === null || budget.dailySafeSpend === undefined
      ? null
      : Number(budget.dailySafeSpend || 0);

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black text-slate-900">
              Monthly Control
            </h3>
            <span
              className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest ring-1 ${getBudgetStatusTone(
                status
              )}`}
            >
              {budgetStatusLabels[status] || status}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {budgetInsights[status] || budgetInsights.no_budget}
          </p>
          {budget.topCategory && (
            <p className="mt-2 text-sm font-semibold text-slate-700">
              Top spending category: {budget.topCategory}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onSetBudget}
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 sm:w-auto"
        >
          {hasBudget ? "Edit Spending Limit" : "Set Spending Limit"}
        </button>
      </div>

      {!hasBudget ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          Set a monthly spending limit to track your pace.
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-bold text-slate-700">Used</span>
              <span className="font-black text-slate-900">
                {percentUsed.toFixed(2)}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white ring-1 ring-slate-100">
              <div
                className={`h-full rounded-full transition-all ${getBudgetProgressTone(
                  status
                )}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {status === "over" && (
              <p className="mt-2 text-xs font-semibold text-rose-600">
                You have passed this month's spending limit.
              </p>
            )}
          </div>

          {dailySafeSpend !== null && (
            <p
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-bold ${
                status === "over" || remaining <= 0
                  ? "border-rose-100 bg-rose-50 text-rose-700"
                  : "border-emerald-100 bg-emerald-50 text-emerald-700"
              }`}
            >
              Safe daily spend left: {formatCurrency(dailySafeSpend)}/day
            </p>
          )}

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <BudgetStat
              label="Spending Limit"
              value={formatCurrency(budget.monthlySpendingLimit)}
            />
            <BudgetStat
              label="Spent This Month"
              value={formatCurrency(budget.spentThisMonth)}
            />
            <BudgetStat
              label="Remaining"
              value={formatCurrency(budget.remaining)}
              tone={remaining < 0 ? "text-rose-600" : "text-emerald-600"}
            />
            <BudgetStat label="Used" value={`${percentUsed.toFixed(2)}%`} />
          </div>
        </>
      )}
    </div>
  );
};

const DebtRealityCard = ({ summary }) => (
  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <BudgetStat
        label="Total Active Debt"
        value={formatCurrency(summary.totalActiveDebt)}
        tone="text-rose-600"
      />
      <BudgetStat
        label="Monthly Debt Pressure"
        value={formatCurrency(summary.monthlyDebtPressure)}
      />
      <BudgetStat
        label="Due Soon"
        value={`${Number(summary.dueSoonCount || 0)} payment${
          Number(summary.dueSoonCount || 0) === 1 ? "" : "s"
        }`}
        tone={Number(summary.dueSoonCount || 0) > 0 ? "text-amber-600" : "text-slate-900"}
      />
    </div>
  </div>
);

const BudgetStat = ({ label, value, tone = "text-slate-900" }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
    <p className="mb-1 text-xs font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className={`break-words text-lg font-black ${tone}`}>{value}</p>
  </div>
);

const GetStartedChecklist = ({ completion, completedCount }) => (
  <section className="mb-10 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
    <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
          Onboarding
        </p>
        <h2 className="text-xl font-black text-slate-900">
          Get Started with Munmai
        </h2>
      </div>
      <p className="text-sm font-semibold text-slate-500">
        {completedCount} of {getStartedItems.length} complete
      </p>
    </div>

    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {getStartedItems.map((item) => {
        const completed = Boolean(completion[item.key]);

        return (
          <div
            key={item.key}
            className={`rounded-2xl border p-4 ${
              completed
                ? "border-emerald-100 bg-emerald-50"
                : "border-slate-100 bg-slate-50"
            }`}
          >
            <div className="mb-3 flex items-start gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                  completed
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-400 ring-1 ring-slate-200"
                }`}
              >
                {completed ? "Done" : ""}
              </span>
              <p
                className={`font-bold ${
                  completed ? "text-emerald-900" : "text-slate-900"
                }`}
              >
                {item.label}
              </p>
            </div>

            {completed ? (
              <p className="text-sm font-semibold text-emerald-700">Complete</p>
            ) : (
              <Link
                to={item.to}
                className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800 sm:w-auto"
              >
                {item.cta}
              </Link>
            )}
          </div>
        );
      })}
    </div>
  </section>
);

const RecentTransactionRow = ({ item }) => (
  <div className="px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/70 md:px-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-black ${
            item.isIncome
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {item.isIncome ? "IN" : "OUT"}
        </div>

        <div className="min-w-0">
          <p className="truncate font-bold text-slate-800">{item.displayTitle}</p>
          <p className="break-words text-[10px] font-black uppercase tracking-widest text-slate-400">
            {item.displaySubLabel} | {new Date(item.date).toLocaleDateString()}
          </p>
          {item.displaySubtitle && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">
              {item.displaySubtitle}
            </p>
          )}
        </div>
      </div>

      <p
        className={`shrink-0 text-lg font-black ${
          item.isIncome
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-slate-900 dark:text-slate-100"
        }`}
      >
        {item.isIncome ? "+" : "-"}
        {formatCurrency(item.amount)}
      </p>
    </div>
  </div>
);

export default Dashboard;
