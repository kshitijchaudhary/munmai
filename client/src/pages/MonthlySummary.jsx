import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { getBudgetSummary } from "../api/budget";
import { getLiabilitySummary } from "../api/liabilities";
import Sidebar from "../components/Sidebar";

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

const budgetStatusLabels = {
  no_budget: "No budget",
  safe: "Safe",
  warning: "Warning",
  over: "Over budget",
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(value || 0));

const normalizeTransaction = (item, type) => ({
  ...item,
  transactionType: type,
  isIncome: type === "income",
  title:
    type === "income"
      ? item.source || item.category || "Income"
      : item.recipient || item.category || "Expense",
  subLabel: item.category || (type === "income" ? "Income" : "Expense"),
});

const getItemDate = (item) => {
  const date = new Date(item.date);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getStatusTone = (status) => {
  if (status === "safe") return "bg-emerald-50 text-emerald-700";
  if (status === "warning") return "bg-amber-50 text-amber-700";
  if (status === "over") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-600";
};

const getFlowBarPercent = (value, maxValue) => {
  if (!maxValue) return 0;
  return Math.max(4, Math.round((Number(value || 0) / maxValue) * 100));
};

const MonthlySummary = () => {
  const [income, setIncome] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [budgetSummary, setBudgetSummary] = useState(null);
  const [debtSummary, setDebtSummary] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, index) => current - index);
  }, []);

  const fetchSummaryData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [incomeResult, expenseResult, budgetResult, debtResult] =
        await Promise.allSettled([
          api.get("/income"),
          api.get("/expenses"),
          getBudgetSummary(),
          getLiabilitySummary(),
        ]);

      if (incomeResult.status === "fulfilled") {
        setIncome(Array.isArray(incomeResult.value.data) ? incomeResult.value.data : []);
      } else {
        setIncome([]);
      }

      if (expenseResult.status === "fulfilled") {
        setExpenses(
          Array.isArray(expenseResult.value.data) ? expenseResult.value.data : []
        );
      } else {
        setExpenses([]);
      }

      setBudgetSummary(
        budgetResult.status === "fulfilled" ? budgetResult.value : null
      );
      setDebtSummary(debtResult.status === "fulfilled" ? debtResult.value : null);

      if (
        incomeResult.status === "rejected" ||
        expenseResult.status === "rejected"
      ) {
        setError("Failed to load monthly transaction data.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummaryData();
  }, [fetchSummaryData]);

  const summary = useMemo(() => {
    const normalizedIncome = income.map((item) => normalizeTransaction(item, "income"));
    const normalizedExpenses = expenses.map((item) =>
      normalizeTransaction(item, "expense")
    );

    const periodIncome = normalizedIncome.filter((item) => {
      const date = getItemDate(item);
      return (
        date &&
        date.getMonth() === selectedMonth &&
        date.getFullYear() === selectedYear
      );
    });
    const periodExpenses = normalizedExpenses.filter((item) => {
      const date = getItemDate(item);
      return (
        date &&
        date.getMonth() === selectedMonth &&
        date.getFullYear() === selectedYear
      );
    });

    const incomeTotal = periodIncome.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const expenseTotal = periodExpenses.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const categoryTotals = periodExpenses.reduce((accumulator, expense) => {
      const category = expense.category || "Other";
      accumulator[category] =
        (accumulator[category] || 0) + Number(expense.amount || 0);
      return accumulator;
    }, {});

    const topCategories = Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const recentTransactions = [...periodIncome, ...periodExpenses]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);
    const maxFlowAmount = Math.max(incomeTotal, expenseTotal, 1);
    const maxCategoryAmount = Math.max(
      ...topCategories.map((category) => Number(category.amount || 0)),
      1
    );
    const insights = [];

    if (expenseTotal > incomeTotal) {
      insights.push("Your expenses are higher than income for this month.");
    }

    if (["warning", "over"].includes(budgetSummary?.status)) {
      insights.push(
        "Monthly Control shows you are close to or over your spending limit."
      );
    }

    if (Number(debtSummary?.monthlyDebtPressure || 0) > 0) {
      insights.push("Debt payments are adding pressure this month.");
    }

    return {
      incomeTotal,
      expenseTotal,
      net: incomeTotal - expenseTotal,
      maxFlowAmount,
      maxCategoryAmount,
      insights,
      topCategories,
      recentTransactions,
      hasData: periodIncome.length > 0 || periodExpenses.length > 0,
      periodLabel: new Date(selectedYear, selectedMonth, 1).toLocaleString(
        "default",
        { month: "long", year: "numeric" }
      ),
    };
  }, [budgetSummary?.status, debtSummary?.monthlyDebtPressure, income, expenses, selectedMonth, selectedYear]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Sidebar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10 lg:ml-72 lg:w-auto">
        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold text-indigo-600">Reports</p>
          <h1 className="text-3xl font-black text-slate-900 md:text-4xl">
            Monthly Summary
          </h1>
          <p className="mt-2 max-w-3xl text-slate-500">
            Review monthly income, expenses, balance, budget pace, and debt
            pressure.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            {error}
          </div>
        )}

        <section className="mb-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
                Active Period
              </p>
              <h2 className="text-2xl font-black text-slate-900">
                {summary.periodLabel}
              </h2>
              <p className="text-sm text-slate-500">
                Select a month to review personal money movement.
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
                onClick={fetchSummaryData}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
              >
                Refresh
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-slate-100 bg-white px-6 py-16 text-center font-semibold text-slate-400 shadow-sm">
            Loading monthly summary...
          </div>
        ) : (
          <>
            <section className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
              <SummaryCard label="Income" value={formatCurrency(summary.incomeTotal)} tone="text-emerald-600" />
              <SummaryCard label="Expenses" value={formatCurrency(summary.expenseTotal)} tone="text-rose-600" />
              <SummaryCard
                label="Net"
                value={formatCurrency(summary.net)}
                tone={summary.net < 0 ? "text-rose-600" : "text-slate-900"}
              />
              <SummaryCard
                label="Monthly Control"
                value={budgetStatusLabels[budgetSummary?.status] || "No budget"}
                badgeTone={getStatusTone(budgetSummary?.status)}
              />
              <SummaryCard
                label="Debt Pressure"
                value={formatCurrency(debtSummary?.monthlyDebtPressure)}
                tone="text-slate-900"
              />
            </section>

            <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
              <IncomeExpenseComparison summary={summary} />
              <NetFlowCard summary={summary} />
            </section>

            {summary.insights.length > 0 && (
              <section className="mb-8 rounded-3xl border border-amber-100 bg-amber-50 p-5 shadow-sm md:p-6">
                <p className="mb-3 text-xs font-black uppercase tracking-widest text-amber-700">
                  Monthly Signals
                </p>
                <div className="space-y-2">
                  {summary.insights.map((insight) => (
                    <p key={insight} className="text-sm font-semibold text-amber-900">
                      {insight}
                    </p>
                  ))}
                </div>
              </section>
            )}

            {!summary.hasData ? (
              <section className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
                <h2 className="text-xl font-black text-slate-900">
                  No data for this month.
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Add income or expenses to see a monthly report for this period.
                </p>
                <Link
                  to="/money/transactions#add-transaction"
                  className="mt-5 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                >
                  Add Transaction
                </Link>
              </section>
            ) : (
              <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                <CategoryBreakdown summary={summary} />

                <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm lg:col-span-7">
                  <div className="border-b border-slate-100 px-5 py-4 md:px-6">
                    <h2 className="text-xl font-black text-slate-900">
                      Recent Transactions
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Latest entries for {summary.periodLabel}.
                    </p>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {summary.recentTransactions.length === 0 ? (
                      <div className="px-6 py-10 text-center text-slate-500">
                        No recent transactions for this month.
                      </div>
                    ) : (
                      summary.recentTransactions.map((transaction) => (
                        <TransactionRow
                          key={`${transaction.transactionType}-${transaction._id}`}
                          transaction={transaction}
                        />
                      ))
                    )}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const IncomeExpenseComparison = ({ summary }) => (
  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6 lg:col-span-7">
    <div className="mb-6">
      <h2 className="text-xl font-black text-slate-900">
        Income vs Expenses
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        A quick visual read on how money moved this month.
      </p>
    </div>

    <div className="space-y-5">
      <FlowBar
        label="Income"
        amount={summary.incomeTotal}
        tone="bg-emerald-500"
        percent={getFlowBarPercent(summary.incomeTotal, summary.maxFlowAmount)}
      />
      <FlowBar
        label="Expenses"
        amount={summary.expenseTotal}
        tone="bg-rose-500"
        percent={getFlowBarPercent(summary.expenseTotal, summary.maxFlowAmount)}
      />
    </div>
  </div>
);

const FlowBar = ({ label, amount, percent, tone }) => (
  <div>
    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
      <span className="font-bold text-slate-700">{label}</span>
      <span className="font-black text-slate-900">{formatCurrency(amount)}</span>
    </div>
    <div className="h-4 overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full transition-all ${tone}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  </div>
);

const NetFlowCard = ({ summary }) => {
  const positive = summary.net >= 0;

  return (
    <div
      className={`rounded-3xl border p-5 shadow-sm md:p-6 lg:col-span-5 ${
        positive
          ? "border-emerald-100 bg-emerald-50"
          : "border-rose-100 bg-rose-50"
      }`}
    >
      <p
        className={`mb-2 text-xs font-black uppercase tracking-widest ${
          positive ? "text-emerald-700" : "text-rose-700"
        }`}
      >
        Net Flow
      </p>
      <p
        className={`text-3xl font-black ${
          positive ? "text-emerald-700" : "text-rose-700"
        }`}
      >
        {formatCurrency(summary.net)}
      </p>
      <p
        className={`mt-4 text-sm font-semibold ${
          positive ? "text-emerald-900" : "text-rose-900"
        }`}
      >
        {positive
          ? "You are positive this month."
          : "You spent more than you earned this month."}
      </p>
    </div>
  );
};

const CategoryBreakdown = ({ summary }) => (
  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6 lg:col-span-5">
    <h2 className="text-xl font-black text-slate-900">Category Breakdown</h2>
    <p className="mt-1 text-sm text-slate-500">
      Top expense categories in {summary.periodLabel}.
    </p>

    <div className="mt-5 space-y-4">
      {summary.topCategories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No expense categories yet for this month.
        </div>
      ) : (
        summary.topCategories.map((category) => (
          <div key={category.category}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-bold text-slate-800">
                {category.category}
              </span>
              <span className="shrink-0 font-black text-rose-600">
                {formatCurrency(category.amount)}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-rose-400"
                style={{
                  width: `${getFlowBarPercent(
                    category.amount,
                    summary.maxCategoryAmount
                  )}%`,
                }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

const SummaryCard = ({ label, value, tone = "text-slate-900", badgeTone }) => (
  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
    <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    {badgeTone ? (
      <span
        className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest ${badgeTone}`}
      >
        {value}
      </span>
    ) : (
      <p className={`break-words text-2xl font-black ${tone}`}>{value}</p>
    )}
  </div>
);

const TransactionRow = ({ transaction }) => {
  const date = getItemDate(transaction);

  return (
    <div className="px-5 py-4 md:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-900">
            {transaction.title}
          </p>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
            {transaction.subLabel} | {date ? date.toLocaleDateString() : "No date"}
          </p>
        </div>
        <p
          className={`text-lg font-black ${
            transaction.isIncome ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {transaction.isIncome ? "+" : "-"}
          {formatCurrency(transaction.amount)}
        </p>
      </div>
    </div>
  );
};

export default MonthlySummary;
