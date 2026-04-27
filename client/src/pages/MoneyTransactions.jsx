import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AddTransaction from "../components/AddTransaction";
import ImportTransactions from "../components/ImportTransactions";
import Sidebar from "../components/Sidebar";
import api from "../api/axios";

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

const formatCurrency = (value) => `$${Number(value || 0).toLocaleString()}`;

const MoneyTransactions = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = ["income", "expense"].includes(searchParams.get("type"))
    ? searchParams.get("type")
    : "all";

  const [data, setData] = useState({ income: [], expenses: [] });
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState(null);
  const [deletingId, setDeletingId] = useState("");
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [filter, setFilter] = useState(initialType);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, index) => current - index);
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);

      const [incomeResult, expenseResult] = await Promise.allSettled([
        api.get("/income"),
        api.get("/expenses"),
      ]);

      if (incomeResult.status === "fulfilled" && expenseResult.status === "fulfilled") {
        setData({
          income: incomeResult.value.data || [],
          expenses: expenseResult.value.data || [],
        });
      } else {
        setData({ income: [], expenses: [] });
        setStatusMessage({
          type: "error",
          message: "Failed to load transactions.",
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    const nextType = ["income", "expense"].includes(searchParams.get("type"))
      ? searchParams.get("type")
      : "all";

    setFilter(nextType);
  }, [searchParams]);

  const pushStatusMessage = useCallback((type, message) => {
    setStatusMessage({ type, message });
  }, []);

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

    const periodTransactions = allTransactions.filter((item) => {
      const itemDate = new Date(item.date);
      return (
        itemDate.getMonth() === selectedMonth &&
        itemDate.getFullYear() === selectedYear
      );
    });

    let filteredTransactions = periodTransactions;

    if (filter === "income") {
      filteredTransactions = filteredTransactions.filter((item) => item.isIncome);
    } else if (filter === "expense") {
      filteredTransactions = filteredTransactions.filter((item) => !item.isIncome);
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (normalizedSearch) {
      filteredTransactions = filteredTransactions.filter((item) =>
        item.searchBlob.includes(normalizedSearch)
      );
    }

    const incomeTotal = periodTransactions
      .filter((item) => item.isIncome)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expenseTotal = periodTransactions
      .filter((item) => !item.isIncome)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const periodLabel = new Date(selectedYear, selectedMonth, 1).toLocaleString(
      "default",
      { month: "long", year: "numeric" }
    );

    return {
      allTransactions,
      periodTransactions,
      filteredTransactions,
      incomeTotal,
      expenseTotal,
      balance: incomeTotal - expenseTotal,
      periodLabel,
    };
  }, [data, filter, searchTerm, selectedMonth, selectedYear]);

  const hasAnyTransactions = stats.allTransactions.length > 0;

  const setTypeFilter = (nextFilter) => {
    setFilter(nextFilter);

    if (nextFilter === "all") {
      setSearchParams({});
      return;
    }

    setSearchParams({ type: nextFilter });
  };

  const handleDelete = async (item) => {
    const typeLabel = item.isIncome ? "income" : "expense";
    const confirmed = window.confirm(`Delete this ${typeLabel}?`);

    if (!confirmed) {
      return;
    }

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

      await fetchTransactions();
      pushStatusMessage("success", `${item.isIncome ? "Income" : "Expense"} deleted.`);
    } catch (error) {
      pushStatusMessage(
        "error",
        error?.response?.data?.message || `Failed to delete ${typeLabel}.`
      );
    } finally {
      setDeletingId("");
    }
  };

  const handleEdit = (item) => {
    setEditingTransaction(item);
    window.location.hash = "add-transaction";
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Sidebar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10 lg:ml-72 lg:w-auto">
        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold text-indigo-600">Money</p>
          <h1 className="text-3xl font-black text-slate-900 md:text-4xl">
            Transactions
          </h1>
          <p className="text-slate-500">
            Add, import, search, and manage daily income and expenses.
          </p>
        </header>

        {statusMessage?.message && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
              statusMessage.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {statusMessage.message}
          </div>
        )}

        <section className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          <SummaryCard label={`${stats.periodLabel} Income`} value={formatCurrency(stats.incomeTotal)} tone="text-emerald-600" />
          <SummaryCard label={`${stats.periodLabel} Expense`} value={formatCurrency(stats.expenseTotal)} tone="text-rose-600" />
          <SummaryCard label={`${stats.periodLabel} Balance`} value={formatCurrency(stats.balance)} tone={stats.balance >= 0 ? "text-slate-900" : "text-rose-600"} />
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-4">
            <div id="add-transaction" className="scroll-mt-28 lg:scroll-mt-8">
              <AddTransaction
                onTransactionAdded={fetchTransactions}
                editingTransaction={editingTransaction}
                onCancelEdit={() => setEditingTransaction(null)}
                onStatusMessage={pushStatusMessage}
              />
            </div>

            <div id="import" className="scroll-mt-28 lg:scroll-mt-8">
              <ImportTransactions onImportComplete={fetchTransactions} />
            </div>
          </div>

          <section
            id="transactions"
            className="scroll-mt-28 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm lg:col-span-8 lg:scroll-mt-8"
          >
            <div className="border-b border-slate-50 p-5 md:p-6">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Transaction List</h2>
                  <p className="text-sm text-slate-500">{stats.periodLabel}</p>
                </div>

                <button
                  type="button"
                  onClick={fetchTransactions}
                  className="text-sm font-bold text-indigo-600 hover:underline"
                >
                  Refresh
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
                <input
                  type="text"
                  placeholder="Search source, vendor, category, notes, amount..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <select
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {["all", "income", "expense"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTypeFilter(type)}
                    className={`rounded-full px-3 py-1 text-sm capitalize ${
                      filter === type
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-50">
              {loading ? (
                <div className="p-10 text-center font-medium text-slate-400">
                  Loading transactions...
                </div>
              ) : !hasAnyTransactions ? (
                <div className="p-10 text-center">
                  <p className="font-semibold text-slate-700">
                    No transactions yet.
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Add your first income or expense to start tracking.
                  </p>
                </div>
              ) : stats.filteredTransactions.length === 0 ? (
                <div className="p-10 text-center text-slate-500">
                  No transactions match this view.
                </div>
              ) : (
                stats.filteredTransactions.map((item) => (
                  <TransactionRow
                    key={`${item.transactionType}-${item._id}`}
                    item={item}
                    deleting={deletingId === item._id}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onStatusMessage={pushStatusMessage}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

const SummaryCard = ({ label, value, tone }) => (
  <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className={`break-words text-2xl font-black sm:text-3xl ${tone}`}>{value}</p>
  </div>
);

const TransactionRow = ({ item, onDelete, onEdit, deleting, onStatusMessage }) => {
  const [openingReceipt, setOpeningReceipt] = useState(false);

  const handleViewReceipt = async () => {
    if (openingReceipt) {
      return;
    }

    try {
      setOpeningReceipt(true);
      const response = await api.get(`/receipts/${item._id}`, {
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(response.data);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
    } catch (error) {
      onStatusMessage?.(
        "error",
        error?.response?.data?.message || "Failed to open receipt."
      );
    } finally {
      setOpeningReceipt(false);
    }
  };

  return (
    <div className="p-4 transition-colors hover:bg-slate-50 md:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
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
              <p className="mt-1 break-words text-sm text-slate-500">
                {item.displaySubtitle}
              </p>
            )}
            {!item.isIncome && item.receiptUrl && (
              <button
                type="button"
                onClick={handleViewReceipt}
                disabled={openingReceipt}
                className="mt-2 text-xs font-semibold text-indigo-600 hover:underline disabled:text-slate-400"
              >
                {openingReceipt ? "Opening..." : "Open receipt"}
              </button>
            )}
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-4 sm:w-auto sm:justify-end">
          <p
            className={`text-lg font-black ${
              item.isIncome ? "text-emerald-600" : "text-slate-900"
            }`}
          >
            {item.isIncome ? "+" : "-"}{formatCurrency(item.amount)}
          </p>
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="text-sm font-semibold text-indigo-600 hover:underline"
          >
            Edit
          </button>
          <button
            type="button"
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

export default MoneyTransactions;
