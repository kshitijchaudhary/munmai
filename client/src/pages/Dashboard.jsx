import { useEffect, useState, useContext, useMemo, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { AuthContext } from "../context/AuthContext";
import AddTransaction from "../components/AddTransaction";
import ImportTransactions from "../components/ImportTransactions";
import AccountTools from "../components/AccountTools";
import api from "../api/axios";
import { exportTaxPackCsv, getTaxPackSummary } from "../api/dashboard";
import { exportMonthlyPdf } from "../utils/exportMonthlyPdf";
import { trackError, trackEvent } from "../utils/telemetry";

const CURRENT_TAX_YEAR = new Date().getFullYear();
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

const buildEmptyTaxPack = (taxYear) => ({
  taxYear,
  summary: {
    trackedExpenseCount: 0,
    trackedBusinessExpenseTotal: 0,
    deductibleTransactionCount: 0,
    deductibleExpenseTotal: 0,
    missingReceiptCount: 0,
    needsReviewCount: 0,
    exportReadyCount: 0,
    receiptCoveragePercent: 100,
    deductibleByCategory: [],
  },
  records: [],
});

const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
};

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
    hasReceipt: !isIncome && Boolean(item.receiptUrl),
    searchBlob: [
      item.source,
      item.recipient,
      item.category,
      item.taxCategory,
      item.expenseType,
      item.notes,
      item.amount,
      item.deductible ? "deductible" : "",
      new Date(item.date).toLocaleDateString(),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
};

const Dashboard = () => {
  const { logout, user } = useContext(AuthContext);

  const [data, setData] = useState({ income: [], expenses: [] });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);

  const [taxPackYear, setTaxPackYear] = useState(CURRENT_TAX_YEAR);
  const [taxPack, setTaxPack] = useState(buildEmptyTaxPack(CURRENT_TAX_YEAR));
  const [taxPackLoading, setTaxPackLoading] = useState(true);
  const [exportingTaxPack, setExportingTaxPack] = useState(false);

  const displayName =
    user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "User";

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, index) => current - index);
  }, []);

  const taxYearOptions = Array.from(
    { length: 6 },
    (_, index) => CURRENT_TAX_YEAR - index
  );

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setTaxPackLoading(true);

    const [incomeResult, expenseResult, taxPackResult] = await Promise.allSettled([
      api.get("/income"),
      api.get("/expenses"),
      getTaxPackSummary(taxPackYear),
    ]);

    if (incomeResult.status === "fulfilled" && expenseResult.status === "fulfilled") {
      setData({
        income: incomeResult.value.data || [],
        expenses: expenseResult.value.data || [],
      });
    } else {
      console.error("Dashboard Sync Error:", {
        incomeResult,
        expenseResult,
      });
      setData({ income: [], expenses: [] });
    }

    if (taxPackResult.status === "fulfilled") {
      setTaxPack(taxPackResult.value || buildEmptyTaxPack(taxPackYear));
    } else {
      console.error("Tax Pack Sync Error:", taxPackResult.reason);
      setTaxPack(buildEmptyTaxPack(taxPackYear));
    }

    setLoading(false);
    setTaxPackLoading(false);
  }, [taxPackYear]);

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

    const totalIncome = normalizedIncome.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const totalExpense = normalizedExpenses.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
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

    const periodTransactions = [...periodIncome, ...periodExpenses].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    const periodIncomeTotal = periodIncome.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const periodExpenseTotal = periodExpenses.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const expenseCategoryMap = periodExpenses.reduce((acc, curr) => {
      const cat = curr.category || "Other";
      acc[cat] = (acc[cat] || 0) + Number(curr.amount || 0);
      return acc;
    }, {});

    const chart = Object.keys(expenseCategoryMap).map((name) => ({
      name,
      value: expenseCategoryMap[name],
    }));

    let filteredTransactions = periodTransactions;

    if (filter === "income") {
      filteredTransactions = periodTransactions.filter((item) => item.isIncome);
    } else if (filter === "expense") {
      filteredTransactions = periodTransactions.filter((item) => !item.isIncome);
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (normalizedSearch) {
      filteredTransactions = filteredTransactions.filter((item) =>
        item.searchBlob.includes(normalizedSearch)
      );
    }

    const periodLabel = new Date(selectedYear, selectedMonth, 1).toLocaleString(
      "default",
      {
        month: "long",
        year: "numeric",
      }
    );

    return {
      totalIncome,
      totalExpense,
      totalBalance: totalIncome - totalExpense,
      periodIncomeTotal,
      periodExpenseTotal,
      periodBalance: periodIncomeTotal - periodExpenseTotal,
      allTransactions,
      periodTransactions,
      filteredTransactions,
      chart,
      periodLabel,
    };
  }, [data, filter, searchTerm, selectedMonth, selectedYear]);

  const handleDelete = async (item) => {
    const typeLabel = item.isIncome ? "income" : "expense";

    const confirmed = window.confirm(
      `Are you sure you want to delete this ${typeLabel}?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(item._id);

      if (item.isIncome) {
        await api.delete(`/income/${item._id}`);
      } else {
        await api.delete(`/expenses/${item._id}`);
      }

      if (editingTransaction?._id === item._id) {
        setEditingTransaction(null);
      }

      await fetchDashboardData();
    } catch (error) {
      console.error("Delete error:", error);
      alert(error?.response?.data?.message || `Failed to delete ${typeLabel}`);
    } finally {
      setDeletingId("");
    }
  };

  const handleEdit = (item) => {
    setEditingTransaction(item);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleExportMonthlyPdf = () => {
    trackEvent("monthly_pdf_exported", {
      monthLabel: stats.periodLabel,
    });

    exportMonthlyPdf({
      userName: displayName,
      monthLabel: stats.periodLabel,
      monthlyIncome: stats.periodIncomeTotal,
      monthlyExpense: stats.periodExpenseTotal,
      monthlyBalance: stats.periodBalance,
      transactions: stats.periodTransactions,
    });
  };

  const handleExportTaxPack = async () => {
    try {
      setExportingTaxPack(true);

      const response = await exportTaxPackCsv(taxPackYear);
      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `${displayName.replace(/\s+/g, "-")}-tax-pack-${taxPackYear}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      trackEvent("tax_pack_exported", {
        taxYear: taxPackYear,
      });
    } catch (error) {
      console.error("Tax Pack export error:", error);
      trackError("tax_pack_export_failed", error.message);
      alert("Failed to export Tax Pack");
    } finally {
      setExportingTaxPack(false);
    }
  };

  const taxPackSummary = taxPack?.summary ?? {};
  const deductibleByCategory = taxPackSummary?.deductibleByCategory ?? [];
  const taxPackRecords = taxPack?.records ?? [];

  if (loading && data.income.length === 0 && data.expenses.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-slate-400 animate-pulse">
        Syncing Financial Vault...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] antialiased pb-20">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 md:px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
          <h1 className="text-xl font-bold text-indigo-600 tracking-tight">
            Munmai
          </h1>

          <button
            onClick={logout}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:shadow-lg transition-all active:scale-95 whitespace-nowrap"
          >
            Sign Out
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-10">
        <header className="mb-8 md:mb-10">
          <p className="text-sm font-semibold text-indigo-600 mb-2">
            {getGreeting()}, {displayName}
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900">
            Financial Summary
          </h2>
          <p className="text-slate-500 font-medium">
            Tracking {stats.allTransactions.length} transactions.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <MetricCard label="Net Balance" value={stats.totalBalance} isBalance />
          <MetricCard label="Total Inflow" value={stats.totalIncome} type="income" />
          <MetricCard label="Total Outflow" value={stats.totalExpense} type="expense" />
        </div>

        <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-100 mb-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                Active period
              </p>
              <h3 className="text-2xl font-black text-slate-900">
                {stats.periodLabel}
              </h3>
              <p className="text-sm text-slate-500">
                Cards, chart, list, and PDF export below reflect this selected month.
              </p>
            </div>

            <div className="flex gap-3">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700"
              >
                {MONTH_OPTIONS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-8">
            <AddTransaction
              onTransactionAdded={fetchDashboardData}
              editingTransaction={editingTransaction}
              onCancelEdit={() => setEditingTransaction(null)}
            />

            <ImportTransactions onImportComplete={fetchDashboardData} />

            <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Tax Pack</h3>
                    <p className="text-sm text-slate-500">
                      Review side-hustle expenses and export a cleaner CSV for your
                      accountant.
                    </p>
                  </div>

                  <select
                    value={taxPackYear}
                    onChange={(e) => setTaxPackYear(Number(e.target.value))}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    {taxYearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                {taxPackLoading ? (
                  <p className="text-sm text-slate-400">Refreshing Tax Pack...</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <MiniMetric
                        label="Deductible total"
                        value={`$${Number(
                          taxPackSummary?.deductibleExpenseTotal || 0
                        ).toLocaleString()}`}
                      />
                      <MiniMetric
                        label="Ready to export"
                        value={taxPackSummary?.exportReadyCount || 0}
                      />
                      <MiniMetric
                        label="Missing receipts"
                        value={taxPackSummary?.missingReceiptCount || 0}
                      />
                      <MiniMetric
                        label="Needs review"
                        value={taxPackSummary?.needsReviewCount || 0}
                      />
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                        Receipt coverage
                      </p>
                      <p className="text-2xl font-black text-slate-900">
                        {taxPackSummary?.receiptCoveragePercent || 0}%
                      </p>
                      <p className="text-sm text-slate-500">
                        {taxPackSummary?.trackedExpenseCount || 0} tax-aware expense
                        {taxPackSummary?.trackedExpenseCount === 1 ? "" : "s"} tracked
                        in {taxPackYear}.
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                        Top deductible categories
                      </p>

                      {deductibleByCategory.length > 0 ? (
                        <div className="space-y-2">
                          {deductibleByCategory
                            .slice(0, 3)
                            .map((item) => (
                              <div
                                key={item.category}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="text-slate-600">{item.category}</span>
                                <span className="font-bold text-slate-900">
                                  ${Number(item.amount || 0).toLocaleString()}
                                </span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">
                          Tag business or mixed expenses to start building this pack.
                        </p>
                      )}
                    </div>

                    <button
                      onClick={handleExportTaxPack}
                      disabled={exportingTaxPack || taxPackRecords.length === 0}
                      className="bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition disabled:bg-slate-300"
                    >
                      {exportingTaxPack ? "Exporting..." : "Export Tax Pack CSV"}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Export Summary
                  </h3>
                  <p className="text-sm text-slate-500">
                    Download your selected month as a PDF summary.
                  </p>
                </div>

                <button
                  onClick={handleExportMonthlyPdf}
                  className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition"
                >
                  Export {stats.periodLabel} PDF
                </button>
              </div>
            </div>

            <AccountTools />

            <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-100 h-[360px] md:h-[380px]">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Spending Breakdown
              </h3>
              <p className="text-sm text-slate-500 mb-2">{stats.periodLabel}</p>

              {stats.chart.length > 0 ? (
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={stats.chart}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
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
                      contentStyle={{ borderRadius: "12px", border: "none" }}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: "12px", fontWeight: "bold" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 font-medium italic">
                  No expense data to visualize for {stats.periodLabel}.
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-5 md:p-6 border-b border-slate-50 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Transactions
                  </h3>
                  <p className="text-sm text-slate-500">{stats.periodLabel}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setFilter("all")}
                    className={`text-sm px-3 py-1 rounded-full ${
                      filter === "all"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    All
                  </button>

                  <button
                    onClick={() => setFilter("income")}
                    className={`text-sm px-3 py-1 rounded-full ${
                      filter === "income"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Income
                  </button>

                  <button
                    onClick={() => setFilter("expense")}
                    className={`text-sm px-3 py-1 rounded-full ${
                      filter === "expense"
                        ? "bg-rose-600 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Expense
                  </button>

                  <button
                    onClick={fetchDashboardData}
                    className="text-indigo-600 text-sm font-bold hover:underline"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <input
                type="text"
                placeholder="Search source, vendor, category, notes, amount..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="divide-y divide-slate-50">
              {loading ? (
                <div className="p-10 text-center text-slate-400 font-medium">
                  Refreshing data...
                </div>
              ) : stats.filteredTransactions.length === 0 ? (
                <div className="p-10 text-center text-slate-400 font-medium">
                  No transactions found for this month and filter.
                </div>
              ) : (
                stats.filteredTransactions.map((item) => (
                  <TransactionRow
                    key={item._id}
                    item={item}
                    deleting={deletingId === item._id}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const MetricCard = ({ label, value, type, isBalance }) => (
  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
    <p
      className={`text-xs font-bold uppercase tracking-widest mb-2 ${
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
          ? value >= 0
            ? "text-slate-900"
            : "text-rose-600"
          : type === "income"
          ? "text-emerald-600"
          : "text-rose-600"
      }`}
    >
      ${Number(value || 0).toLocaleString()}
    </p>
  </div>
);

const MiniMetric = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-100 p-4">
    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">
      {label}
    </p>
    <p className="text-xl font-black text-slate-900">{value}</p>
  </div>
);

const TransactionRow = ({ item, onDelete, onEdit, deleting }) => {
  const handleViewReceipt = async () => {
    try {
      const response = await api.get(`/receipts/${item._id}`, {
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(response.data);
      const receiptWindow = window.open(blobUrl, "_blank", "noopener,noreferrer");
      if (receiptWindow && typeof receiptWindow.addEventListener === "function") {
        try {
          receiptWindow.addEventListener(
            "load",
            () => window.URL.revokeObjectURL(blobUrl),
            { once: true }
          );
        } catch {
          window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
        }
      } else {
        window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
      }
    } catch (error) {
      console.error("Receipt fetch error:", error);
      alert(error?.response?.data?.message || "Failed to open receipt");
    }
  };

  return (
    <div className="p-4 md:p-5 hover:bg-slate-50 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
              item.isIncome
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {item.isIncome ? "IN" : "OUT"}
          </div>

          <div className="min-w-0">
            <p className="font-bold text-slate-800 truncate">{item.displayTitle}</p>

            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {item.displaySubLabel} | {new Date(item.date).toLocaleDateString()}
            </p>

            {item.displaySubtitle && (
              <p className="text-sm text-slate-500 mt-1 break-words">
                {item.displaySubtitle}
              </p>
            )}

            {!item.isIncome &&
              (item.expenseType !== "personal" || item.deductible) && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {item.expenseType && item.expenseType !== "personal" && (
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">
                      {item.expenseType === "mixed" ? "Mixed use" : "Business"}
                    </span>
                  )}

                  {item.deductible && (
                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                      {Number(item.deductiblePercent || 0)}% deductible
                    </span>
                  )}

                  {!item.isIncome && item.taxCategory && (
                    <span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                      {item.taxCategory}
                    </span>
                  )}
                </div>
              )}

            {!item.isIncome && item.receiptUrl && (
              <button
                type="button"
                onClick={handleViewReceipt}
                className="inline-block mt-2 text-xs font-semibold text-indigo-600 hover:underline"
              >
                View receipt
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4 flex-wrap">
          <p
            className={`text-lg font-black ${
              item.isIncome ? "text-emerald-600" : "text-slate-900"
            }`}
          >
            {item.isIncome ? "+" : "-"}${Number(item.amount || 0).toLocaleString()}
          </p>

          <button
            onClick={() => onEdit(item)}
            className="text-sm font-semibold text-indigo-600 hover:underline"
          >
            Edit
          </button>

          <button
            onClick={() => onDelete(item)}
            disabled={deleting}
            className="text-sm font-semibold text-rose-600 hover:underline disabled:text-slate-400"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
