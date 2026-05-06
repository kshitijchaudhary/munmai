import { useCallback, useEffect, useState } from "react";
import {
  getOpeningBalance,
  updateOpeningBalance,
} from "../api/openingBalance";
import Sidebar from "../components/Sidebar";

const emptyOpeningBalance = {
  amount: 0,
  asOfDate: "",
  notes: "",
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(value || 0));

const toDateInputValue = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
};

const OpeningBalance = () => {
  const [openingBalance, setOpeningBalance] = useState(emptyOpeningBalance);
  const [formData, setFormData] = useState(emptyOpeningBalance);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchOpeningBalance = useCallback(async () => {
    try {
      setLoading(true);
      setMessage(null);

      const data = await getOpeningBalance();
      const nextOpeningBalance = {
        ...emptyOpeningBalance,
        ...(data?.openingBalance || {}),
        asOfDate: toDateInputValue(data?.openingBalance?.asOfDate),
      };

      setOpeningBalance(nextOpeningBalance);
      setFormData(nextOpeningBalance);
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Failed to load opening balance.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOpeningBalance();
  }, [fetchOpeningBalance]);

  const handleChange = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const amount = Number(formData.amount);

    if (!Number.isFinite(amount) || amount < 0) {
      setMessage({
        type: "error",
        text: "Opening balance amount must be greater than or equal to 0.",
      });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const data = await updateOpeningBalance({
        amount,
        asOfDate: formData.asOfDate,
        notes: formData.notes,
      });
      const nextOpeningBalance = {
        ...emptyOpeningBalance,
        ...(data?.openingBalance || {}),
        asOfDate: toDateInputValue(data?.openingBalance?.asOfDate),
      };

      setOpeningBalance(nextOpeningBalance);
      setFormData(nextOpeningBalance);
      setMessage({
        type: "success",
        text: "Opening balance saved.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Failed to save opening balance.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const confirmed = window.confirm(
      "Reset opening balance to $0? This keeps your transactions unchanged."
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setMessage(null);

      const data = await updateOpeningBalance({
        amount: 0,
        asOfDate: "",
        notes: "",
      });
      const nextOpeningBalance = {
        ...emptyOpeningBalance,
        ...(data?.openingBalance || {}),
        asOfDate: toDateInputValue(data?.openingBalance?.asOfDate),
      };

      setOpeningBalance(nextOpeningBalance);
      setFormData(nextOpeningBalance);
      setMessage({
        type: "success",
        text: "Opening balance reset.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Failed to reset opening balance.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Sidebar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-10 lg:ml-72 lg:w-auto">
        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold text-indigo-600">
            Financial Life
          </p>
          <h1 className="text-3xl font-black text-slate-900 md:text-4xl">
            Opening Balance
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Set your starting money position before tracking begins.
          </p>
        </header>

        {message && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6 lg:col-span-5">
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
              Current Opening Balance
            </p>
            {loading ? (
              <div className="py-10 font-semibold text-slate-400">
                Loading opening balance...
              </div>
            ) : (
              <>
                <p className="break-words text-4xl font-black text-slate-900">
                  {formatCurrency(openingBalance.amount)}
                </p>
                <p className="mt-3 text-sm text-slate-500">
                  {openingBalance.asOfDate
                    ? `As of ${openingBalance.asOfDate}`
                    : "No as-of date set yet."}
                </p>
                {openingBalance.notes && (
                  <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    {openingBalance.notes}
                  </p>
                )}
              </>
            )}
          </section>

          <section className="rounded-3xl border border-indigo-100 bg-indigo-50 p-5 shadow-sm md:p-6 lg:col-span-7">
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-500">
              Starting Point
            </p>
            <h2 className="text-xl font-black text-slate-900">
              How opening balance works
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-indigo-950">
              Opening balance is added to your all-time personal balance. It
              does not count as income for monthly reports.
            </p>
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6 lg:col-span-12">
            <h2 className="text-xl font-black text-slate-900">
              Set or Update Opening Balance
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              This is the money you already had before starting Munmai. It is
              used as a starting point, not monthly income.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  Amount
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(event) =>
                    handleChange("amount", event.target.value)
                  }
                  disabled={loading || saving}
                  required
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  As-of date
                </span>
                <input
                  type="date"
                  value={formData.asOfDate}
                  onChange={(event) =>
                    handleChange("asOfDate", event.target.value)
                  }
                  disabled={loading || saving}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  Notes
                </span>
                <textarea
                  value={formData.notes}
                  onChange={(event) =>
                    handleChange("notes", event.target.value)
                  }
                  disabled={loading || saving}
                  rows="4"
                  placeholder="Optional context for your starting balance"
                  className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={loading || saving}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300 sm:w-auto"
                >
                  {saving ? "Saving..." : "Save Opening Balance"}
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading || saving}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:text-slate-300 sm:w-auto"
                >
                  Reset Opening Balance
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
};

export default OpeningBalance;
