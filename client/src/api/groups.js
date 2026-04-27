import api from "./axios";

export const getGroupSummary = async (groupId) => {
  const response = await api.get(`/groups/${groupId}/summary`);
  return response.data;
};

export const getGroupMembers = async (groupId) => {
  const response = await api.get(`/groups/${groupId}/memberships`);
  return response.data;
};

export const createSharedExpense = async (payload) => {
  const response = await api.post("/shared-expenses", payload);
  return response.data;
};

export const createGroupSettlement = async (groupId, payload) => {
  const response = await api.post(`/groups/${groupId}/settlements`, payload);
  return response.data;
};

export const createGroupInvitation = async (groupId, email) => {
  const response = await api.post(`/groups/${groupId}/invitations`, { email });
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
