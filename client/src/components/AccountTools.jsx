import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { AuthContext } from "../context/AuthContext";
import { trackError, trackEvent } from "../utils/telemetry";

const AccountTools = () => {
  const { logout, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleExportData = async () => {
    try {
      setExporting(true);

      const response = await api.get("/auth/export-data", {
        responseType: "blob",
      });
      trackEvent("account_export_requested");
      const blob = new Blob([response.data], {
        type: "application/json;charset=utf-8;",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName =
        user?.name?.trim()?.replace(/\s+/g, "-").toLowerCase() || "munmai-user";

      link.href = url;
      link.download = `${safeName}-munmai-export.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export data error:", error);
      trackError("account_export_failed", error.message);
      alert("Failed to export account data");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Delete your account and all transaction data permanently?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      await api.delete("/auth/account");
      trackEvent("account_deleted");
      logout();
      navigate("/login");
    } catch (error) {
      console.error("Delete account error:", error);
      trackError("account_delete_failed", error.message);
      alert(error?.response?.data?.message || "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-100">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Account Tools</h3>
          <p className="text-sm text-slate-500">
            Export your data anytime or permanently delete your account from inside
            the app.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportData}
          disabled={exporting}
          className="bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition disabled:bg-slate-300"
        >
          {exporting ? "Preparing export..." : "Export My Data"}
        </button>

        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="border border-rose-200 text-rose-600 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-rose-50 transition disabled:text-rose-300 disabled:border-rose-100"
        >
          {deleting ? "Deleting account..." : "Delete Account"}
        </button>

        <div className="text-xs text-slate-500 flex flex-wrap gap-3">
          <Link to="/privacy" className="hover:underline">
            Privacy
          </Link>
          <Link to="/terms" className="hover:underline">
            Terms
          </Link>
          <Link to="/what-we-store" className="hover:underline">
            What We Store
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AccountTools;
