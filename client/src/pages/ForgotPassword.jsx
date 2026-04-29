import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import LegalFooter from "../components/LegalFooter";
import { trackError, trackEvent } from "../utils/telemetry";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatusMessage(null);

    try {
      setLoading(true);
      const { data } = await api.post("/auth/forgot-password", {
        email: email.trim(),
      });

      trackEvent("forgot_password_requested");
      setStatusMessage({
        type: "success",
        text:
          data.message ||
          "If an account exists, a password reset email has been sent.",
      });
    } catch (error) {
      const message =
        error.response?.data?.message || "Password reset could not be requested.";

      trackError("forgot_password_failed", message, {
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
          Forgot Password
        </h2>
        <p className="mb-5 text-slate-500">
          Enter your email and we will send a password reset link if an account
          exists.
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

        <input
          type="email"
          placeholder="Email"
          required
          className="mb-4 w-full rounded-lg border p-3"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={loading}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>

        <p className="mt-4 text-center text-sm text-slate-600">
          Remembered your password?{" "}
          <Link to="/login" className="font-semibold text-blue-600 hover:underline">
            Back to login
          </Link>
        </p>

        <LegalFooter />
      </form>
    </div>
  );
};

export default ForgotPassword;
