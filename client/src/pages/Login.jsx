import { useState, useContext, useMemo, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import api from "../api/axios";
import { AuthContext } from "../context/authContext";
import LegalFooter from "../components/LegalFooter";
import { trackError, trackEvent } from "../utils/telemetry";

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [statusMessage, setStatusMessage] = useState(null);
  const [resending, setResending] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const flashMessage = location.state?.flashMessage;
  const flashType = location.state?.flashType;

  const verifiedMessage = useMemo(() => {
    if (flashMessage) {
      return {
        type: flashType || "success",
        text: flashMessage,
      };
    }

    const params = new URLSearchParams(location.search);
    const session = params.get("session");
    const verified = params.get("verified");
    const registered = params.get("registered");
    const reason = window.sessionStorage.getItem("authRedirectReason");

    if (session === "expired" || reason === "expired") {
      return {
        type: "error",
        text: "Your session expired. Please log in again.",
      };
    }

    if (verified === "success") {
      return {
        type: "success",
        text: "Email verified successfully. You can now log in.",
      };
    }

    if (verified === "failed") {
      return {
        type: "error",
        text: "Verification link is invalid or expired.",
      };
    }

    if (registered === "success") {
      return {
        type: "success",
        text: "Registration successful. Please verify your email before logging in.",
      };
    }

    return null;
  }, [flashMessage, flashType, location.search]);

  useEffect(() => {
    const reason = window.sessionStorage.getItem("authRedirectReason");
    if (reason !== "expired") return;

    const params = new URLSearchParams(location.search);
    if (params.get("session") !== "expired") {
      window.sessionStorage.removeItem("authRedirectReason");
      navigate("/login?session=expired", { replace: true });
    } else {
      window.sessionStorage.removeItem("authRedirectReason");
    }
  }, [location.search, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const { data } = await api.post("/auth/login", formData);
      trackEvent("login_success");
      login(data);
      navigate("/dashboard");
    } catch (err) {
      const responseMessage = err.response?.data?.message || "Login failed";
      const hint = err.response?.data?.hint;
      const message = hint ? `${responseMessage} ${hint}` : responseMessage;
      const canResend = err.response?.status === 403;

      trackError("login_failed", message, {
        status: err.response?.status || 500,
      });
      setStatusMessage({
        type: "error",
        text: message,
        canResend,
      });
    }
  };

  const handleResendVerification = async () => {
    if (!formData.email) {
      setStatusMessage({
        type: "error",
        text: "Enter your email address first.",
      });
      return;
    }

    try {
      setResending(true);
      const { data } = await api.post("/auth/resend-verification", {
        email: formData.email,
      });
      trackEvent("resend_verification_requested");
      setStatusMessage({
        type: "success",
        text: data.message,
      });
    } catch (err) {
      const message = err.response?.data?.message || "Failed to resend verification email";
      trackError("resend_verification_failed", message);
      setStatusMessage({
        type: "error",
        text: message,
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="p-8 bg-white rounded-2xl shadow-xl w-full max-w-md"
      >
        <h2 className="text-2xl font-bold mb-2 text-blue-600">Munmai Login</h2>
        <p className="text-slate-500 mb-5">Sign in to continue</p>

        {verifiedMessage && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm font-medium ${
              verifiedMessage.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {verifiedMessage.text}
          </div>
        )}

        {statusMessage && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm font-medium ${
              statusMessage.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            <p>{statusMessage.text}</p>
            {statusMessage.canResend && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending}
                className="mt-2 font-semibold underline disabled:no-underline disabled:opacity-60"
              >
                {resending ? "Sending..." : "Resend verification email"}
              </button>
            )}
          </div>
        )}

        <input
          type="email"
          placeholder="Email"
          required
          className="w-full p-3 mb-4 border rounded-lg"
          value={formData.email}
          onChange={(e) =>
            setFormData({ ...formData, email: e.target.value })
          }
        />

        <input
          type="password"
          placeholder="Password"
          required
          className="w-full p-3 mb-4 border rounded-lg"
          value={formData.password}
          onChange={(e) =>
            setFormData({ ...formData, password: e.target.value })
          }
        />

        <button className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 font-semibold">
          Login
        </button>

        <p className="mt-3 text-center text-sm">
          <Link
            to="/forgot-password"
            className="font-semibold text-blue-600 hover:underline"
          >
            Forgot password?
          </Link>
        </p>

        <p className="mt-4 text-sm text-slate-600 text-center">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="text-blue-600 font-semibold hover:underline">
            Register
          </Link>
        </p>

        <LegalFooter />
      </form>
    </div>
  );
};

export default Login;
