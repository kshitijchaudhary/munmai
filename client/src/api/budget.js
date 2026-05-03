import api from "./axios";

export const getBudgetSummary = async () => {
  const response = await api.get("/budget");
  return response.data;
};

export const updateBudgetLimit = async (monthlySpendingLimit) => {
  const response = await api.put("/budget", { monthlySpendingLimit });
  return response.data;
};
