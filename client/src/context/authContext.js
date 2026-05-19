import { createContext } from "react";

export const AuthContext = createContext();

export const getStoredUser = () => {
  if (typeof window === "undefined") return null;

  const savedUser = window.localStorage.getItem("user");

  if (!savedUser) return null;

  try {
    return JSON.parse(savedUser);
  } catch {
    window.localStorage.removeItem("user");
    return null;
  }
};
