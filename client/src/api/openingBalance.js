import api from "./axios";

export const getOpeningBalance = async () => {
  const response = await api.get("/opening-balance");
  return response.data;
};

export const updateOpeningBalance = async (payload) => {
  const response = await api.put("/opening-balance", payload);
  return response.data;
};
