import api from "./axios";

export const getLiabilities = async (filters = {}) => {
  const response = await api.get("/liabilities", { params: filters });
  return response.data;
};

export const getLiabilitySummary = async () => {
  const response = await api.get("/liabilities/summary");
  return response.data;
};

export const createLiability = async (payload) => {
  const response = await api.post("/liabilities", payload);
  return response.data;
};

export const updateLiability = async (id, payload) => {
  const response = await api.put(`/liabilities/${id}`, payload);
  return response.data;
};

export const deleteLiability = async (id) => {
  const response = await api.delete(`/liabilities/${id}`);
  return response.data;
};

export const getLiabilityPayments = async (id) => {
  const response = await api.get(`/liabilities/${id}/payments`);
  return response.data;
};

export const recordLiabilityPayment = async (id, payload) => {
  const response = await api.post(`/liabilities/${id}/payments`, payload);
  return response.data;
};
