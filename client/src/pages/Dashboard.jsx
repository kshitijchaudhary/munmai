import { useEffect, useState, useContext, useMemo, useCallback } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { AuthContext } from "../context/AuthContext";
import AddTransaction from "../components/AddTransaction";
import api from "../api/axios";
import { exportMonthlyPdf } from "../utils/exportMonthlyPdf";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace("/api", "");

const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
};

const Dashboard = () => {
  const { logout, user } = useContext(AuthContext);
  const [data, setData] = useState({ income: [], expenses: [] });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [inc, exp] = await Promise.all([
        api.get("/income"),
        api.get("/expenses"),
      ]);

      setData({
        income: inc.data || [],
        expenses: exp.data || [],
      });
    } catch (error) {
      console.error("Dashboard Sync Error:", error);
      setData({ income: [], expenses: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleDelete = async (item) => {
    const isIncome = !!item.source;
    const typeLabel = isIncome ? "income" : "expense";

    const confirmed = window.confirm(
      `Are you sure you want to delete this ${typeLabel}?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(item._id);

      if (isIncome) {
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
    exportMonthlyPdf({
      userName: displayName,
      monthLabel: stats.monthLabel,
      monthlyIncome: stats.monthlyIncome,
      monthlyExpense: stats.monthlyExpense,
      monthlyBalance: stats.monthlyBalance,
      transactions: stats.monthlyTransactions,
    });
  };

  const stats = useMemo(() => {
    const totalInc = data.income.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const totalExp = data.expenses.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const categoryMap = data.expenses.reduce((acc, curr) => {
      const cat = curr.category || "Other";
      acc[cat] = (acc[cat] || 0) + Number(curr.amount || 0);
      return acc;
    }, {});

    const chart = Object.keys(categoryMap).map((name) => ({
      name,
      value: categoryMap[name],
    }));

    const allTransactions = [...data.income, ...data.expenses].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyIncomeTransactions = data.income.filter((item) => {
      const itemDate = new Date(item.date);
      return (
        itemDate.getMonth() === currentMonth &&
        itemDate.getFullYear() === currentYear
      );
    });

    const monthlyExpenseTransactions = data.expenses.filter((item) => {
      const itemDate = new Date(item.date);
      return (
        itemDate.getMonth() === currentMonth &&
        itemDate.getFullYear() === currentYear
      );
    });

    const monthlyTransactions = [
      ...monthlyIncomeTransactions,
      ...monthlyExpenseTransactions,
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const monthlyIncome = monthlyIncomeTransactions.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const monthlyExpense = monthlyExpenseTransactions.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    let filteredTransactions = allTransactions;

    if (filter === "income") {
      filteredTransactions = allTransactions.filter((item) => !!item.source);
    } else if (filter === "expense") {
      filteredTransactions = allTransactions.filter((item) => !item.source);
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (normalizedSearch) {
      filteredTransactions = filteredTransactions.filter((item) => {
        const fields = [
          item.source,
          item.recipient,
          item.category,
          item.notes,
          item.amount?.toString(),
          new Date(item.date).toLocaleDateString(),
        ];

        return fields.some((field) =>
          String(field || "").toLowerCase().includes(normalizedSearch)
        );
      });
    }

    return {
      totalInc,
      totalExp,
      balance: totalInc - totalExp,
      chart,
      transactions: allTransactions,
      filteredTransactions,
      monthlyIncome,
      monthlyExpense,
      monthlyBalance: monthlyIncome - monthlyExpense,
      monthlyTransactions,
      monthLabel: now.toLocaleString("default", {
        month: "long",
        year: "numeric",
      }),
    };
  }, [data, filter, searchTerm]);

  const COLORS = [
    "#4F46E5",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
    "#64748B",
  ];

  const displayName =
    user?.name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "User";

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
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Babal<span className="text-indigo-600">.Mitra</span>
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
            Tracking {stats.transactions.length} transactions.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <MetricCard label="Net Balance" value={stats.balance} isBalance />
          <MetricCard label="Total Inflow" value={stats.totalInc} type="income" />
          <MetricCard label="Total Outflow" value={stats.totalExp} type="expense" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <MetricCard label="This Month Income" value={stats.monthlyIncome} type="income" />
          <MetricCard label="This Month Expense" value={stats.monthlyExpense} type="expense" />
          <MetricCard label="This Month Balance" value={stats.monthlyBalance} isBalance />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-8">
            <AddTransaction
              onTransactionAdded={fetchDashboardData}
              editingTransaction={editingTransaction}
              onCancelEdit={() => setEditingTransaction(null)}
            />

            <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Export Summary
                  </h3>
                  <p className="text-sm text-slate-500">
                    Download your monthly financial summary as a PDF.
                  </p>
                </div>

                <button
                  onClick={handleExportMonthlyPdf}
                  className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition"
                >
                  Export Monthly PDF
                </button>
              </div>
            </div>

            <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-100 h-[360px] md:h-[380px]">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Spending Breakdown
              </h3>

              {stats.chart.length > 0 ? (
                <ResponsiveContainer width="100%" height="85%">
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
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "none" }} />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: "12px", fontWeight: "bold" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 font-medium italic">
                  No expense data to visualize yet.
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-5 md:p-6 border-b border-slate-50 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <h3 className="text-lg font-bold text-slate-900">
                  Recent Transactions
                </h3>

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
                placeholder="Search by source, recipient, category, notes, amount..."
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
                  No transactions found for this filter or search.
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

const TransactionRow = ({ item, onDelete, onEdit, deleting }) => {
  const isIncome = !!item.source;
  const title = isIncome ? item.source : item.recipient || "Expense";

  return (
    <div className="p-4 md:p-5 hover:bg-slate-50 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
              isIncome ? "bg-emerald-50" : "bg-rose-50"
            }`}
          >
            {isIncome ? "💰" : "🛒"}
          </div>

          <div className="min-w-0">
            <p className="font-bold text-slate-800 truncate">{title}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {item.category} • {new Date(item.date).toLocaleDateString()}
            </p>

            {!isIncome && item.receiptUrl && (
              <a
                href={`${API_BASE}${item.receiptUrl}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-2 text-xs font-semibold text-indigo-600 hover:underline"
              >
                View receipt
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4 flex-wrap">
          <p
            className={`text-lg font-black ${
              isIncome ? "text-emerald-600" : "text-slate-900"
            }`}
          >
            {isIncome ? "+" : "-"}${Number(item.amount || 0).toLocaleString()}
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