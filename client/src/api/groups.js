import api from "./axios";

export const getGroupSummary = async (groupId) => {
  const response = await api.get(`/groups/${groupId}/summary`);
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
