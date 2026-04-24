import api from "./axios";

export const getGroupSummary = async (groupId) => {
  const response = await api.get(`/groups/${groupId}/summary`);
  return response.data;
};
