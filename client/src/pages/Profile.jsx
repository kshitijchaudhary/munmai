import { useCallback, useContext, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { AuthContext } from "../context/AuthContext";
import {
  getCurrentUserProfile,
  updateCurrentUserProfile,
} from "../api/users";

const emptyProfile = {
  name: "",
  username: "",
  email: "",
};

const Profile = () => {
  const { user, login } = useContext(AuthContext);
  const [profile, setProfile] = useState(emptyProfile);
  const [formData, setFormData] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setStatusMessage(null);

      const data = await getCurrentUserProfile();
      const nextProfile = {
        name: data?.name || "",
        username: data?.username || "",
        email: data?.email || "",
      };

      setProfile(nextProfile);
      setFormData(nextProfile);
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to load profile.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

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
      setSaving(true);
      const updatedProfile = await updateCurrentUserProfile({
        name: formData.name,
        username: formData.username,
      });
      const nextProfile = {
        name: updatedProfile?.name || "",
        username: updatedProfile?.username || "",
        email: updatedProfile?.email || profile.email,
      };

      setProfile(nextProfile);
      setFormData(nextProfile);

      if (user?.token) {
        login({
          ...user,
          id: updatedProfile?.id || user.id,
          name: nextProfile.name,
          email: nextProfile.email,
          username: nextProfile.username,
          token: user.token,
        });
      }

      setStatusMessage({
        type: "success",
        text: "Profile updated.",
      });
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to update profile.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Sidebar />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6 md:py-10 lg:ml-72 lg:w-auto">
        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold text-indigo-600">Account</p>
          <h1 className="text-3xl font-black text-slate-900 md:text-4xl">
            Profile
          </h1>
          <p className="mt-2 text-slate-500">
            View your account details and update your public profile identity.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
          {loading ? (
            <div className="py-12 text-center font-medium text-slate-400">
              Loading profile...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {statusMessage && (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                    statusMessage.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-rose-200 bg-rose-50 text-rose-800"
                  }`}
                >
                  {statusMessage.text}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(event) => handleChange("name", event.target.value)}
                  required
                  disabled={saving}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(event) =>
                    handleChange("username", event.target.value)
                  }
                  required
                  minLength="3"
                  pattern="[A-Za-z0-9_]+"
                  autoCapitalize="none"
                  autoComplete="username"
                  disabled={saving}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Use letters, numbers, and underscores only.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  readOnly
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Email changes are not available in this profile page.
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-400 sm:w-auto"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
};

export default Profile;
