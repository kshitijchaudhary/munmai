import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { getBudgetSummary, updateBudgetLimit } from "../api/budget";
import { getLiabilitySummary } from "../api/liabilities";
import AddTransaction from "../components/AddTransaction";
import Modal from "../components/Modal";
import ReceiptUploadModal from "../components/ReceiptUploadModal";
import Sidebar from "../components/Sidebar";
import { AuthContext } from "../context/authContext";

const CURRENT_MONTH = new Date().getMonth();
const CURRENT_YEAR = new Date().getFullYear();

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
  const [budgetSummary, setBudgetSummary] = useState(buildEmptyBudgetSummary);
  const [debtRealitySummary, setDebtRealitySummary] = useState(
    buildEmptyDebtRealitySummary
  );
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [receiptUploadModalOpen, setReceiptUploadModalOpen] = useState(false);
  const [budgetLimitDraft, setBudgetLimitDraft] = useState("");
  const [budgetMessage, setBudgetMessage] = useState(null);
  const [savingBudget, setSavingBudget] = useState(false);
  const [loading, setLoading] = useState(true);
  const [transactionError, setTransactionError] = useState("");
  const [budgetError, setBudgetError] = useState("");
  const [debtRealityError, setDebtRealityError] = useState("");
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

    const [incomeResult, expenseResult, budgetResult, debtRealityResult] =
      await Promise.allSettled([
        api.get("/income"),
        api.get("/expenses"),
        getBudgetSummary(),
        getLiabilitySummary(),
      ]);

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
    const allTimeIncomeTotal = normalizedIncome.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const allTimeExpenseTotal = normalizedExpenses.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

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
      allTimeIncomeTotal,
      allTimeExpenseTotal,
      allTimeBalance: allTimeIncomeTotal - allTimeExpenseTotal,
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

  const hasAnyTransactions = stats.allTransactions.length > 0;
  const showOnboarding = !hasAnyTransactions;

  const handleTransactionSaved = async () => {
    setTransactionModalOpen(false);
    await fetchDashboardData();
  };

  if (loading && !hasAnyTransactions) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Sidebar />
        <main className="flex min-h-screen items-center justify-center px-4 font-bold text-slate-400 dark:text-slate-500 lg:ml-72">
          Syncing Munmai OS...
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 antialiased dark:bg-slate-950">
      <Sidebar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10 lg:ml-72 lg:w-auto">
        <header className="mb-8 md:mb-10">
          <p className="mb-2 text-sm font-semibold text-indigo-600">
            {getGreeting()}, {displayName}
          </p>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white md:text-4xl">
            Dashboard
          </h1>
          <p className="font-medium text-slate-500 dark:text-slate-400">
            {hasAnyTransactions
              ? "Capture today, review later, and understand this month."
              : "Add one transaction or receipt to start building your monthly picture."}
          </p>
        </header>

        {(transactionError || budgetError || debtRealityError) && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
            {transactionError || budgetError || debtRealityError}
          </div>
        )}

        {showOnboarding && (
          <section className="mb-8 rounded-3xl border border-indigo-100 bg-indigo-50 p-5 shadow-sm dark:border-indigo-900/60 dark:bg-indigo-950/30 md:p-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Start simple.
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Add one transaction or upload one receipt. You can organize the
              rest later.
            </p>
          </section>
        )}

        <section className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-12 xl:items-start">
          <div className="space-y-6 xl:col-span-7">
            <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                Quick capture
              </p>
              <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-white md:text-4xl">
                Add what happened now.
              </h2>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <CommandAction
                  title="Add transaction"
                  description="Add what happened today."
                  onClick={() => setTransactionModalOpen(true)}
                  primary
                />
                <CommandAction
                  title="Upload receipt"
                  description="Upload now, organize later."
                  onClick={() => setReceiptUploadModalOpen(true)}
                  primary
                />
              </div>
            </div>

            <div>
              <SectionHeading
                title="Monthly Control"
                description="A simple check on this month's spending pace."
              />
              <MonthlyControlCard budget={budgetSummary} onSetBudget={openBudgetModal} />
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800 md:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Recent Transactions
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
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

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <div className="px-6 py-10 text-center font-medium text-slate-400 dark:text-slate-500">
                    Refreshing data...
                  </div>
                ) : stats.recentTransactions.length === 0 ? (
                  <div className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
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
          </div>

          <div className="space-y-4 xl:col-span-5 xl:self-start">
            <div className="rounded-[2rem] border border-slate-100 bg-slate-50/70 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                    This Month
                  </p>
                  <h3 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                    {stats.periodLabel}
                  </h3>
                </div>

                <div className="flex gap-2">
                  <select
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(Number(event.target.value))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <MiniMoneyCard label="In" value={stats.periodIncomeTotal} tone="text-emerald-600 dark:text-emerald-400" />
                <MiniMoneyCard label="Out" value={stats.periodExpenseTotal} tone="text-rose-600 dark:text-rose-400" />
                <MiniMoneyCard
                  label="Net"
                  value={stats.periodBalance}
                  tone={stats.periodBalance < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}
                />
              </div>
            </div>

            <OverallPositionCard balance={stats.allTimeBalance} />
            <div>
              <SectionHeading
                title="Needs review"
                description="Review only what needs attention."
              />
              <NeedsReviewCard
                missingReceiptCount={data.expenses.filter((expense) => !String(expense?.receiptUrl || expense?.receipt || "").trim()).length}
                budgetStatus={budgetSummary.status}
                dueSoonCount={debtRealitySummary.dueSoonCount}
              />
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
                Review / More
              </p>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                More tools
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Use these when you need deeper tracking.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <SimpleLink to="/imports" label="Import Statements" />
                <SimpleLink to="/money/transactions" label="Transactions" />
                <SimpleLink to="/monthly-summary" label="Monthly Summary" />
                <SimpleLink to="/debt-reality" label="Debt Reality" />
                <SimpleLink to="/groups" label="Groups" />
                <SimpleLink to="/money/tax-pack" label="Tax Pack" />
                <SimpleLink to="/opening-balance" label="Opening Balance" />
              </div>
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

        <Modal
          open={transactionModalOpen}
          onClose={() => setTransactionModalOpen(false)}
          title="Add Transaction"
          description="Record income or expenses without leaving the dashboard."
        >
          <AddTransaction
            onTransactionAdded={handleTransactionSaved}
            onCancelEdit={() => setTransactionModalOpen(false)}
          />
        </Modal>

        <ReceiptUploadModal
          isOpen={receiptUploadModalOpen}
          onClose={() => setReceiptUploadModalOpen(false)}
          onUploaded={fetchDashboardData}
        />
      </main>
    </div>
  );
};

const SectionHeading = ({ title, description, action }) => (
  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h2 className="text-xl font-black text-slate-900 dark:text-white">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
    </div>
    {action}
  </div>
);

const CommandAction = ({ title, description, to, onClick, primary = false }) => {
  const className = `rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
    primary
      ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
      : "border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
  }`;

  const content = (
    <>
      <p className="font-black">{title}</p>
      <p
        className={`mt-1 text-sm ${
          primary ? "text-white/75 dark:text-slate-600" : "text-slate-500 dark:text-slate-400"
        }`}
      >
        {description}
      </p>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return (
    <Link
      to={to}
      className={className}
    >
      {content}
    </Link>
  );
};

const MiniMoneyCard = ({ label, value, tone }) => (
  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className={`text-2xl font-black ${tone}`}>{formatCurrency(value)}</p>
  </div>
);

const SimpleLink = ({ to, label }) => (
  <Link
    to={to}
    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-200 hover:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
  >
    <span>{label}</span>
    <span className="text-slate-400">View</span>
  </Link>
);

const OverallPositionCard = ({ balance }) => (
  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
      Total position
    </p>
    <p
      className={`text-3xl font-black ${
        Number(balance || 0) < 0
          ? "text-rose-600 dark:text-rose-400"
          : "text-slate-900 dark:text-white"
      }`}
    >
      {formatCurrency(balance)}
    </p>
    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
      All income minus all expenses already loaded on this dashboard.
    </p>
  </div>
);

const NeedsReviewCard = ({ missingReceiptCount, budgetStatus, dueSoonCount }) => {
  const items = [];

  if (missingReceiptCount > 0) {
    items.push({
      label: `${missingReceiptCount} expense${missingReceiptCount === 1 ? "" : "s"} missing receipts`,
      helper: "Upload receipts when you have time.",
      to: "/money/receipts",
    });
  }

  if (["warning", "over"].includes(budgetStatus)) {
    items.push({
      label:
        budgetStatus === "over"
          ? "Monthly spending is over limit"
          : "Monthly spending is close to limit",
      helper: "Check your spending pace before the month ends.",
      to: "/monthly-summary",
    });
  }

  if (Number(dueSoonCount || 0) > 0) {
    items.push({
      label: `${dueSoonCount} debt payment${Number(dueSoonCount) === 1 ? "" : "s"} due soon`,
      helper: "Review upcoming debt pressure.",
      to: "/debt-reality",
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-5">
        <p className="text-lg font-black text-slate-900 dark:text-white">
          All caught up for now.
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Nothing urgent is showing from the data already loaded here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-5">
      {items.map((item) => (
        <Link
          key={item.label}
          to={item.to}
          className="block rounded-2xl border border-amber-100 bg-amber-50 px-3.5 py-3 transition hover:border-amber-200 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
        >
          <p className="font-black text-amber-900 dark:text-amber-200">
            {item.label}
          </p>
          <p className="mt-1 text-sm font-medium text-amber-800/80 dark:text-amber-300/80">
            {item.helper}
          </p>
        </Link>
      ))}
    </div>
  );
};

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
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
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
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {budgetInsights[status] || budgetInsights.no_budget}
          </p>
          {budget.topCategory && (
            <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Top spending category: {budget.topCategory}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onSetBudget}
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white sm:w-auto"
        >
          {hasBudget ? "Edit Spending Limit" : "Set Spending Limit"}
        </button>
      </div>

      {!hasBudget ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
          Set a monthly spending limit to track your pace.
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-bold text-slate-700 dark:text-slate-300">Used</span>
              <span className="font-black text-slate-900 dark:text-white">
                {percentUsed.toFixed(2)}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
              <div
                className={`h-full rounded-full transition-all ${getBudgetProgressTone(
                  status
                )}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {status === "over" && (
              <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
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
              } dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200`}
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
              tone={
                remaining < 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }
            />
            <BudgetStat label="Used" value={`${percentUsed.toFixed(2)}%`} />
          </div>
        </>
      )}
    </div>
  );
};

const BudgetStat = ({ label, value, tone = "text-slate-900 dark:text-slate-100" }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
    <p className="mb-1 text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
      {label}
    </p>
    <p className={`break-words text-lg font-black ${tone}`}>
      {value}
    </p>
  </div>
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
