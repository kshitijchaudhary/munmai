import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

const hasReceipt = (expense) =>
  Boolean(String(expense?.receiptUrl || expense?.receipt || "").trim());

const formatCurrency = (value) => `$${Number(value || 0).toLocaleString()}`;

const MoneyReceipts = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openingReceiptId, setOpeningReceiptId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [category, setCategory] = useState("all");
  const [receiptStatus, setReceiptStatus] = useState("all");

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, index) => current - index);
  }, []);

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const { data } = await api.get("/expenses");
      setExpenses(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || "Failed to load receipts.");
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const categories = useMemo(() => {
    const values = expenses
      .map((expense) => expense.category || "Other")
      .filter(Boolean);

    return ["all", ...Array.from(new Set(values)).sort()];
  }, [expenses]);

  const receiptScopeExpenses = useMemo(() => {
    return expenses
      .filter((expense) => {
        const expenseDate = new Date(expense.date);
        return (
          expenseDate.getMonth() === selectedMonth &&
          expenseDate.getFullYear() === selectedYear
        );
      })
      .filter((expense) => category === "all" || expense.category === category);
  }, [category, expenses, selectedMonth, selectedYear]);

  const filteredExpenses = useMemo(() => {
    return receiptScopeExpenses
      .filter((expense) => {
        if (receiptStatus === "with") {
          return hasReceipt(expense);
        }

        if (receiptStatus === "missing") {
          return !hasReceipt(expense);
        }

        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [receiptScopeExpenses, receiptStatus]);

  const stats = useMemo(() => {
    const checked = filteredExpenses.length;
    const withReceipts = filteredExpenses.filter(hasReceipt).length;
    const missingReceipts = checked - withReceipts;

    return {
      checked,
      withReceipts,
      missingReceipts,
      coverage: checked > 0 ? Math.round((withReceipts / checked) * 100) : 0,
    };
  }, [filteredExpenses]);

  const hasAnyExpenses = expenses.length > 0;
  const allTrackedExpensesHaveReceipts =
    hasAnyExpenses &&
    receiptScopeExpenses.length > 0 &&
    receiptScopeExpenses.every(hasReceipt);

  const openReceipt = async (expenseId) => {
    if (openingReceiptId) {
      return;
    }

    try {
      setOpeningReceiptId(expenseId);
      const response = await api.get(`/receipts/${expenseId}`, {
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(response.data);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
    } catch (receiptError) {
      setError(receiptError.response?.data?.message || "Failed to open receipt.");
    } finally {
      setOpeningReceiptId("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Sidebar />
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10 lg:ml-72">
        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold text-indigo-600">Money</p>
          <h1 className="text-3xl font-black text-slate-900 md:text-4xl">
            Receipts
          </h1>
          <p className="text-slate-500">
            Track receipt coverage across your recorded expenses.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            {error}
          </div>
        )}

        <section className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
          <SummaryCard label="Expenses Checked" value={stats.checked} />
          <SummaryCard label="With Receipts" value={stats.withReceipts} tone="text-emerald-600" />
          <SummaryCard label="Missing Receipts" value={stats.missingReceipts} tone="text-rose-600" />
          <SummaryCard label="Coverage" value={`${stats.coverage}%`} />
        </section>

        <section className="mb-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
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

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All categories" : item}
                </option>
              ))}
            </select>

            <select
              value={receiptStatus}
              onChange={(event) => setReceiptStatus(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <option value="all">All receipts</option>
              <option value="with">With receipt</option>
              <option value="missing">Missing receipt</option>
            </select>
          </div>
        </section>

        {allTrackedExpensesHaveReceipts && (
          <section className="mb-8 rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-emerald-800 shadow-sm md:px-6">
            <p className="font-semibold">All tracked expenses have receipts.</p>
            <p className="mt-1 text-sm text-emerald-700">
              This selected period and category are fully covered.
            </p>
          </section>
        )}

        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4 md:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Expense Receipts</h2>
                <p className="text-sm text-slate-500">
                  Open stored receipts or identify missing ones.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchExpenses}
                className="text-sm font-bold text-indigo-600 hover:underline"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Vendor</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Receipt Status</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-10 text-center text-slate-400">
                      Loading receipts...
                    </td>
                  </tr>
                ) : !hasAnyExpenses ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-10 text-center">
                      <p className="font-semibold text-slate-700">
                        No expenses to check for receipts yet.
                      </p>
                      <Link
                        to="/money/transactions#add-transaction"
                        className="mt-3 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                      >
                        Add Expense
                      </Link>
                    </td>
                  </tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-10 text-center text-slate-500">
                      No expenses match these receipt filters.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((expense) => {
                    const receiptExists = hasReceipt(expense);

                    return (
                      <tr key={expense._id} className="align-top">
                        <td className="px-5 py-4 text-slate-600">
                          {new Date(expense.date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {expense.recipient || "Expense"}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {expense.category || "Other"}
                        </td>
                        <td className="px-5 py-4 font-bold text-slate-900">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="px-5 py-4">
                          {receiptExists ? (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                              Receipt saved
                            </span>
                          ) : (
                            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
                              Missing receipt
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {receiptExists ? (
                            <button
                              type="button"
                              onClick={() => openReceipt(expense._id)}
                              disabled={openingReceiptId === expense._id}
                              className="font-semibold text-indigo-600 hover:underline disabled:text-slate-400"
                            >
                              {openingReceiptId === expense._id ? "Opening..." : "Open receipt"}
                            </button>
                          ) : (
                            <span className="text-slate-400">Missing receipt</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

const SummaryCard = ({ label, value, tone = "text-slate-900" }) => (
  <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className={`text-3xl font-black ${tone}`}>{value}</p>
  </div>
);

export default MoneyReceipts;
