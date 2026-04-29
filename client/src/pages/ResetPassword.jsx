import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import LegalFooter from "../components/LegalFooter";
import { trackError, trackEvent } from "../utils/telemetry";

const ResetPassword = () => {
  const { token } = useParams();
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [resetComplete, setResetComplete] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatusMessage(null);

    try {
      setLoading(true);
      const { data } = await api.post(`/auth/reset-password/${token}`, formData);

      trackEvent("password_reset_success");
      setResetComplete(true);
      setFormData({ password: "", confirmPassword: "" });
      setStatusMessage({
        type: "success",
        text: data.message || "Password reset successful. You can now log in.",
      });
    } catch (error) {
      const message = error.response?.data?.message || "Password reset failed.";

      trackError("password_reset_failed", message, {
        status: error.response?.status || 500,
      });
      setStatusMessage({
        type: "error",
        text: message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl"
      >
        <h2 className="mb-2 text-2xl font-bold text-blue-600">
          Reset Password
        </h2>
        <p className="mb-5 text-slate-500">
          Choose a new password for your Munmai account.
        </p>

        {statusMessage && (
          <div
            className={`mb-4 rounded-lg border p-3 text-sm font-medium ${
              statusMessage.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {!resetComplete && (
          <>
            <input
              type="password"
              placeholder="New password"
              required
              minLength="6"
              className="mb-4 w-full rounded-lg border p-3"
              value={formData.password}
              onChange={(event) => handleChange("password", event.target.value)}
              disabled={loading}
            />

            <input
              type="password"
              placeholder="Confirm new password"
              required
              minLength="6"
              className="mb-4 w-full rounded-lg border p-3"
              value={formData.confirmPassword}
              onChange={(event) =>
                handleChange("confirmPassword", event.target.value)
              }
              disabled={loading}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {loading ? "Resetting..." : "Reset password"}
            </button>
          </>
        )}

        <p className="mt-4 text-center text-sm text-slate-600">
          <Link to="/login" className="font-semibold text-blue-600 hover:underline">
            Back to login
          </Link>
        </p>

        <LegalFooter />
      </form>
    </div>
  );
};

export default ResetPassword;
