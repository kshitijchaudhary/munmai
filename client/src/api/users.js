import api from "./axios";

export const getCurrentUserProfile = async () => {
  const { data } = await api.get("/users/me");
  return data;
};

export const updateCurrentUserProfile = async (payload) => {
  const { data } = await api.put("/users/me", payload);
  return data;
};
