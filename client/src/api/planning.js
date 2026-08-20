import api from "./axios";

export const getPlanning = async () => {
  const response = await api.get("/planning");
  return response.data;
};

export const updatePlanning = async (payload) => {
  const response = await api.put("/planning", payload);
  return response.data;
};

export const prepareNextPlanningCycle = async (nextPayday) => {
  const response = await api.post("/planning/prepare-next-cycle", {
    nextPayday,
  });
  return response.data;
};

export const getSafeToSpend = async () => {
  const response = await api.get("/planning/safe-to-spend");
  return response.data;
};
