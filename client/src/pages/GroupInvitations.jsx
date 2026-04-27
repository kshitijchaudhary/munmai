import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  acceptGroupInvitation,
  declineGroupInvitation,
  getMyGroupInvitations,
} from "../api/groups";
import Sidebar from "../components/Sidebar";

const getGroupName = (invitation) =>
  invitation?.groupId?.name || invitation?.group?.name || "Unnamed group";

const getInviterLabel = (invitation) => {
  const inviter = invitation?.invitedBy;

  if (!inviter) {
    return "a Munmai user";
  }

  return inviter.name || inviter.email || "a Munmai user";
};

const GroupInvitations = () => {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState("");
  const [message, setMessage] = useState(null);

  const fetchInvitations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyGroupInvitations();
      setInvitations(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to load invitations.",
      });
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleAccept = async (invitationId) => {
    try {
      setActingId(invitationId);
      setMessage(null);
      await acceptGroupInvitation(invitationId);
      await fetchInvitations();
      setMessage({
        type: "success",
        text: "Invitation accepted. You can now access the group.",
        showGroupsLink: true,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to accept invitation.",
      });
    } finally {
      setActingId("");
    }
  };

  const handleDecline = async (invitationId) => {
    try {
      setActingId(invitationId);
      setMessage(null);
      await declineGroupInvitation(invitationId);
      await fetchInvitations();
      setMessage({ type: "success", text: "Invitation declined." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to decline invitation.",
      });
    } finally {
      setActingId("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Sidebar />
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10 lg:ml-72">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-indigo-600">Groups</p>
            <h1 className="text-3xl font-black text-slate-900 md:text-4xl">
              Invitations
            </h1>
            <p className="mt-2 text-slate-500">
              Review group invites and choose which shared spaces to join.
            </p>
          </div>

          <Link
            to="/groups"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-100"
          >
            View groups
          </Link>
        </header>

        {message?.text && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{message.text}</span>
              {message.showGroupsLink && (
                <Link
                  to="/groups"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
                >
                  Go to Groups
                </Link>
              )}
            </div>
          </div>
        )}

        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4 md:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Pending Invitations
                </h2>
                <p className="text-sm text-slate-500">
                  Accepting an invite adds the group to your group list.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchInvitations}
                disabled={loading}
                className="text-sm font-bold text-indigo-600 hover:underline disabled:text-slate-400"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="px-6 py-10 text-center font-medium text-slate-400">
                Loading invitations...
              </div>
            ) : invitations.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="font-semibold text-slate-700">
                  No pending invitations.
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  When someone invites you to a group, it will appear here.
                </p>
                <Link
                  to="/groups"
                  className="mt-4 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                >
                  Go to Groups
                </Link>
              </div>
            ) : (
              invitations.map((invitation) => {
                const invitationId = invitation._id;
                const inviterLabel = getInviterLabel(invitation);

                return (
                  <div
                    key={invitationId}
                    className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">
                        {getGroupName(invitation)}
                      </p>
                      {inviterLabel && (
                        <p className="mt-1 text-sm text-slate-500">
                          Invited by {inviterLabel}
                        </p>
                      )}
                      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
                        Pending
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => handleAccept(invitationId)}
                        disabled={Boolean(actingId)}
                        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300"
                      >
                        {actingId === invitationId ? "Working..." : "Accept"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecline(invitationId)}
                        disabled={Boolean(actingId)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:text-slate-400"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default GroupInvitations;
