import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import LegalFooter from "../components/LegalFooter";
import { trackError, trackEvent } from "../utils/telemetry";

const Register = () => {
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);
    setLoading(true);

    try {
      const { data } = await api.post("/auth/register", formData);

      trackEvent("register_success");

      setStatusMessage({
        type: "success",
        text:
          data.message || "Check your email to verify your account.",
      });

      setTimeout(() => {
        navigate("/login?registered=success", {
          state: {
            flashMessage:
              data.message || "Check your email to verify your account.",
            flashType: "success",
          },
        });
      }, 2500);
    } catch (err) {
      const responseMessage =
        err.response?.data?.message || "Registration failed";
      const hint = err.response?.data?.hint;
      const details = err.response?.data?.details;
      const message = [responseMessage, hint, details]
        .filter(Boolean)
        .join(" ");

      trackError("register_failed", message, {
        status: err.response?.status || 500,
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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="p-8 bg-white rounded-2xl shadow-xl w-full max-w-md"
      >
        <h2 className="text-2xl font-bold mb-2 text-blue-600">Create Account</h2>
        <p className="text-slate-500 mb-5">Start using Munmai</p>

        {statusMessage && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm font-medium border ${
              statusMessage.type === "success"
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        <input
          type="text"
          placeholder="Full Name"
          className="w-full p-3 mb-4 border rounded-lg"
          value={formData.name}
          onChange={(e) => handleChange("name", e.target.value)}
          disabled={loading}
        />

        <input
          type="email"
          placeholder="Email"
          className="w-full p-3 mb-4 border rounded-lg"
          value={formData.email}
          onChange={(e) => handleChange("email", e.target.value)}
          disabled={loading}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-3 mb-4 border rounded-lg"
          value={formData.password}
          onChange={(e) => handleChange("password", e.target.value)}
          disabled={loading}
        />

        <input
          type="password"
          placeholder="Confirm Password"
          className="w-full p-3 mb-4 border rounded-lg"
          value={formData.confirmPassword}
          onChange={(e) => handleChange("confirmPassword", e.target.value)}
          disabled={loading}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 font-semibold disabled:bg-blue-400 disabled:cursor-not-allowed"
        >
          {loading ? "Creating account..." : "Register"}
        </button>

        <p className="mt-4 text-sm text-slate-600 text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 font-semibold hover:underline">
            Login
          </Link>
        </p>

        <LegalFooter />
      </form>
    </div>
  );
};

export default Register;