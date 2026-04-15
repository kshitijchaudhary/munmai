import api from "./axios";

export const getDashboardSummary = async () => {
  const response = await api.get("/dashboard/summary");
  return response.data;
};

export const getTaxPackSummary = async (taxYear) => {
  const response = await api.get("/dashboard/tax-pack/summary", {
    params: { year: taxYear },
  });

  return response.data;
};

export const exportTaxPackCsv = async (taxYear) => {
  return api.get("/dashboard/tax-pack/export", {
    params: { year: taxYear },
    responseType: "blob",
  });
};
