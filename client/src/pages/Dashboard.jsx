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
import { getDashboardSummary } from "../api/dashboard";
import Sidebar from "../components/Sidebar";
import { AuthContext } from "../context/AuthContext";

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

const quickActions = [
  {
    title: "Add Transaction",
    description: "Record income or expenses.",
    to: "/money/transactions#add-transaction",
  },
  {
    title: "View Transactions",
    description: "Search, edit, and manage daily money movement.",
    to: "/money/transactions",
  },
  {
    title: "Receipts",
    description: "Check receipt coverage and missing proof.",
    to: "/money/receipts",
  },
  {
    title: "Tax Pack",
    description: "Review deductible expenses and export CSV.",
    to: "/money/tax-pack",
  },
  {
    title: "Groups",
    description: "Manage shared balances and settlements.",
    to: "/groups",
  },
];

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState({ income: [], expenses: [] });
  const [dashboardSummary, setDashboardSummary] = useState(
    buildEmptyDashboardSummary
  );
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [transactionError, setTransactionError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);

  const displayName =
    user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "User";

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, index) => current - index);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);

    const [summaryResult, incomeResult, expenseResult] = await Promise.allSettled([
      getDashboardSummary(),
      api.get("/income"),
      api.get("/expenses"),
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

  const sharedMoney =
    dashboardSummary.sharedMoney ?? buildEmptyDashboardSummary().sharedMoney;
  const hasAnyTransactions = stats.allTransactions.length > 0;

  if (loading && !hasAnyTransactions) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex min-h-screen items-center justify-center px-4 font-bold text-slate-400 lg:ml-72">
          Syncing Financial Vault...
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 antialiased">
      <Sidebar />
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10 lg:ml-72">
        <header className="mb-8 md:mb-10">
          <p className="mb-2 text-sm font-semibold text-indigo-600">
            {getGreeting()}, {displayName}
          </p>
          <h1 className="text-3xl font-black text-slate-900 md:text-4xl">
            Financial Summary
          </h1>
          <p className="font-medium text-slate-500">
            {hasAnyTransactions
              ? `Tracking ${stats.allTransactions.length} transactions across your account.`
              : "No account activity yet. Add your first income or expense to begin tracking."}
          </p>
        </header>

        {(dashboardError || transactionError) && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            {dashboardError || transactionError}
          </div>
        )}

        <section className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <MetricCard
            label="Personal Balance"
            value={dashboardSummary.balance}
            isBalance
          />
          <MetricCard
            label="Income Total"
            value={dashboardSummary.incomeTotal}
            type="income"
          />
          <MetricCard
            label="Expense Total"
            value={dashboardSummary.expenseTotal}
            type="expense"
          />
        </section>

        <section className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <MetricCard label="You Owe" value={sharedMoney.totalYouOwe} type="expense" />
          <MetricCard
            label="You Are Owed"
            value={sharedMoney.totalYouAreOwed}
            type="income"
          />
          <MetricCard
            label="Shared Net Balance"
            value={sharedMoney.netBalance}
            isBalance
          />
        </section>

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
                Monthly cards and spending breakdown reflect this selected period.
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
          <MetricCard
            label={`${stats.periodLabel} Income`}
            value={stats.periodIncomeTotal}
            type="income"
          />
          <MetricCard
            label={`${stats.periodLabel} Expense`}
            value={stats.periodExpenseTotal}
            type="expense"
          />
          <MetricCard
            label={`${stats.periodLabel} Balance`}
            value={stats.periodBalance}
            isBalance
          />
        </section>

        <section className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {quickActions.map((action) => (
            <QuickActionCard key={action.title} action={action} />
          ))}
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
      className={`text-3xl font-black ${
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

const QuickActionCard = ({ action }) => (
  <Link
    to={action.to}
    className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-100 hover:shadow-md"
  >
    <p className="font-black text-slate-900">{action.title}</p>
    <p className="mt-2 text-sm text-slate-500">{action.description}</p>
  </Link>
);

const RecentTransactionRow = ({ item }) => (
  <div className="px-5 py-4 transition-colors hover:bg-slate-50 md:px-6">
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
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
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
        className={`text-lg font-black ${
          item.isIncome ? "text-emerald-600" : "text-slate-900"
        }`}
      >
        {item.isIncome ? "+" : "-"}
        {formatCurrency(item.amount)}
      </p>
    </div>
  </div>
);

export default Dashboard;
