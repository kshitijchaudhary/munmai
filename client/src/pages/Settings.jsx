import { useContext } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import ThemeToggle from "../components/ThemeToggle";
import { AuthContext } from "../context/authContext";
import { useTheme } from "../hooks/useTheme";

const getDisplayValue = (value, fallback = "Not set") =>
  String(value || "").trim() || fallback;

const Settings = () => {
  const { user } = useContext(AuthContext);
  const { isDark } = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Sidebar />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10 lg:ml-72 lg:w-auto">
        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold text-indigo-600">Settings</p>
          <h1 className="text-3xl font-black text-slate-900 md:text-4xl">
            Settings
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Manage account and app preferences.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6 lg:col-span-5">
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
              Account
            </p>
            <h2 className="text-xl font-black text-slate-900">
              Profile Details
            </h2>
            <div className="mt-5 space-y-3">
              <InfoRow label="Name" value={getDisplayValue(user?.name)} />
              <InfoRow label="Username" value={getDisplayValue(user?.username)} />
              <InfoRow label="Email" value={getDisplayValue(user?.email)} />
            </div>
            <Link
              to="/profile"
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 sm:w-auto"
            >
              Edit Profile
            </Link>
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6 lg:col-span-7">
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
              App Preferences
            </p>
            <h2 className="text-xl font-black text-slate-900">
              Money Context
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              These defaults keep reports and Tax Pack language aligned with how
              Munmai is currently configured.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PreferenceCard label="Default Currency" value="CAD" />
              <PreferenceCard label="Country / Context" value="Canada" />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-slate-900">Appearance</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Current mode: {isDark ? "Dark" : "Light"}
                  </p>
                </div>
                <ThemeToggle compact />
              </div>
            </div>

            <p className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-900">
              Persistent preference editing can be added later when reports and
              Tax Pack need configurable country and currency behavior.
            </p>
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6 lg:col-span-12">
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">
              Data
            </p>
            <h2 className="text-xl font-black text-slate-900">
              Import and Review Tools
            </h2>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <DataLink
                to="/imports"
                title="Import Statements"
                description="Review CSV or PDF statement rows before adding them to Munmai."
              />
              <DataLink
                to="/money/receipts"
                title="Receipts"
                description="Check tracked expenses for receipt coverage."
              />
              <DataLink
                to="/money/tax-pack"
                title="Tax Pack"
                description="Review deductible expenses and export CSV."
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

const InfoRow = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
    <p className="text-xs font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className="mt-1 break-words font-bold text-slate-900">{value}</p>
  </div>
);

const PreferenceCard = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
    <p className="text-xs font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
  </div>
);

const DataLink = ({ to, title, description }) => (
  <Link
    to={to}
    className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-indigo-100 hover:bg-white hover:shadow-sm"
  >
    <p className="font-black text-slate-900">{title}</p>
    <p className="mt-2 text-sm text-slate-500">{description}</p>
  </Link>
);

export default Settings;
