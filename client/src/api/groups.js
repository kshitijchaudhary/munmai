import api from "./axios";

export const getGroupSummary = async (groupId) => {
  const response = await api.get(`/groups/${groupId}/summary`);
  return response.data;
};

export const getGroupMembers = async (groupId) => {
  const response = await api.get(`/groups/${groupId}/memberships`);
  return response.data;
};

export const updateGroup = async (groupId, payload) => {
  const response = await api.put(`/groups/${groupId}`, payload);
  return response.data;
};

export const deleteGroup = async (groupId) => {
  const response = await api.delete(`/groups/${groupId}`);
  return response.data;
};

export const getGroupExpenseHistory = async (groupId) => {
  const response = await api.get(`/groups/${groupId}/expenses`);
  return response.data;
};

export const getGroupSettlementHistory = async (groupId) => {
  const response = await api.get(`/groups/${groupId}/settlements`);
  return response.data;
};

export const createSharedExpense = async (payload, idempotencyKey) => {
  const response = await api.post("/shared-expenses", payload, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return response.data;
};

export const createGroupSettlement = async (groupId, payload, idempotencyKey) => {
  const response = await api.post(`/groups/${groupId}/settlements`, payload, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return response.data;
};

export const createGroupInvitation = async (groupId, email) => {
  const response = await api.post(`/groups/${groupId}/invitations`, { email });
  return response.data;
};

export const requestGroupJoin = async (joinCode) => {
  const response = await api.post("/groups/join", { joinCode });
  return response.data;
};

export const approveGroupMembership = async (groupId, membershipId) => {
  const response = await api.post(
    `/groups/${groupId}/memberships/${membershipId}/approve`
  );
  return response.data;
};

export const rejectGroupMembership = async (groupId, membershipId) => {
  const response = await api.post(
    `/groups/${groupId}/memberships/${membershipId}/reject`
  );
  return response.data;
};

export const getMyGroupInvitations = async () => {
  const response = await api.get("/group-invitations");
  return response.data;
};

export const acceptGroupInvitation = async (invitationId) => {
  const response = await api.post(`/group-invitations/${invitationId}/accept`);
  return response.data;
};

export const declineGroupInvitation = async (invitationId) => {
  const response = await api.post(`/group-invitations/${invitationId}/decline`);
  return response.data;
};
