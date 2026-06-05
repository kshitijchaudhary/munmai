import { useMemo } from "react";
import { Link } from "react-router-dom";
import { hasValidToken } from "../utils/authToken";
import LegalFooter from "./LegalFooter";

const getStoredUser = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!hasValidToken(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const LegalPageLayout = ({ title, subtitle, children }) => {
  const isAuthenticated = useMemo(() => {
    const user = getStoredUser();
    return Boolean(user);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <Link
          to={isAuthenticated ? "/settings" : "/login"}
          className="inline-flex items-center text-sm font-semibold text-slate-600 hover:underline mb-6"
        >
          {isAuthenticated ? "Back to Settings" : "Back to Login"}
        </Link>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 md:p-10">
          <h1 className="text-3xl font-black text-slate-900 mb-2">{title}</h1>
          <p className="text-slate-500 mb-8">{subtitle}</p>
          <div className="space-y-8 text-slate-700">{children}</div>
        </div>

        <LegalFooter />
      </div>
    </div>
  );
};

export default LegalPageLayout;
