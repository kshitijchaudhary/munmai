import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { exportTaxPackCsv, getTaxPackSummary } from "../api/dashboard";
import Sidebar from "../components/Sidebar";
import { AuthContext } from "../context/AuthContext";

const CURRENT_TAX_YEAR = new Date().getFullYear();

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
    receiptCoveragePercent: 0,
    deductibleByCategory: [],
  },
});

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(value || 0));

const MoneyTaxPack = () => {
  const { user } = useContext(AuthContext);
  const [taxYear, setTaxYear] = useState(CURRENT_TAX_YEAR);
  const [taxPack, setTaxPack] = useState(buildEmptyTaxPack(CURRENT_TAX_YEAR));
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const taxYearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, index) => CURRENT_TAX_YEAR - index),
    []
  );

  const summary = taxPack?.summary || buildEmptyTaxPack(taxYear).summary;
  const deductibleByCategory = Array.isArray(summary.deductibleByCategory)
    ? summary.deductibleByCategory
    : [];

  const displayName =
    user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "user";

  const fetchTaxPack = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getTaxPackSummary(taxYear);
      setTaxPack(data || buildEmptyTaxPack(taxYear));
    } catch (fetchError) {
      setTaxPack(buildEmptyTaxPack(taxYear));
      setError(
        fetchError.response?.data?.message || "Failed to load Tax Pack summary."
      );
    } finally {
      setLoading(false);
    }
  }, [taxYear]);

  useEffect(() => {
    fetchTaxPack();
  }, [fetchTaxPack]);

  const handleExport = async () => {
    try {
      setExporting(true);
      setError("");

      const response = await exportTaxPackCsv(taxYear);
      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `${displayName.replace(/\s+/g, "-")}-tax-pack-${taxYear}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError.response?.data?.message || "Failed to export Tax Pack CSV.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Sidebar />
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10 lg:ml-72">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-indigo-600">Reports</p>
            <h1 className="text-3xl font-black text-slate-900 md:text-4xl">
              Tax Pack
            </h1>
            <p className="text-slate-500">
              Review deductible expenses and export a CSV for tax preparation.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={taxYear}
              onChange={(event) => setTaxYear(Number(event.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
            >
              {taxYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleExport}
              disabled={loading || exporting}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:bg-slate-300"
            >
              {exporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            {error}
          </div>
        )}

        <section className="mb-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                Selected Tax Year
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">{taxYear}</p>
            </div>

            <button
              type="button"
              onClick={fetchTaxPack}
              disabled={loading}
              className="text-sm font-bold text-indigo-600 hover:underline disabled:text-slate-400"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            label="Deductible Total"
            value={formatCurrency(summary.deductibleExpenseTotal)}
            tone="text-emerald-600"
          />
          <SummaryCard label="Ready to Export" value={summary.exportReadyCount || 0} />
          <SummaryCard
            label="Missing Receipts"
            value={summary.missingReceiptCount || 0}
            tone="text-rose-600"
          />
          <SummaryCard
            label="Needs Review"
            value={summary.needsReviewCount || 0}
            tone="text-amber-600"
          />
          <SummaryCard
            label="Receipt Coverage"
            value={`${Number(summary.receiptCoveragePercent || 0).toLocaleString()}%`}
          />
        </section>

        <section className="grid grid-cols-1 gap-8 xl:grid-cols-12">
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6 xl:col-span-4">
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
              Tax-Aware Expenses
            </p>
            <p className="text-3xl font-black text-slate-900">
              {summary.trackedExpenseCount || 0}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {formatCurrency(summary.trackedBusinessExpenseTotal)} in business or mixed
              expenses tracked for {taxYear}.
            </p>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-900">
                {summary.deductibleTransactionCount || 0} deductible transaction
                {summary.deductibleTransactionCount === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Export-ready count depends on deductible status, receipt, tax category,
                and deductible percentage.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm xl:col-span-8">
            <div className="border-b border-slate-100 px-5 py-4 md:px-6">
              <h2 className="text-lg font-bold text-slate-900">
                Deductible by Category
              </h2>
              <p className="text-sm text-slate-500">
                Category totals based on deductible business and mixed expenses.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="px-6 py-10 text-center text-slate-400">
                  Loading Tax Pack...
                </div>
              ) : deductibleByCategory.length === 0 ? (
                <div className="px-6 py-10 text-center text-slate-500">
                  No deductible categories found for {taxYear}.
                </div>
              ) : (
                deductibleByCategory.map((item) => (
                  <div
                    key={item.category}
                    className="flex flex-col gap-2 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6"
                  >
                    <p className="font-bold text-slate-900">{item.category}</p>
                    <p className="text-lg font-black text-slate-900">
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                ))
              )}
            </div>
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

export default MoneyTaxPack;
