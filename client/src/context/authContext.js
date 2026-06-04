import { createContext } from "react";
import { hasValidToken } from "../utils/authToken";

export const AuthContext = createContext();

export const getStoredUser = () => {
  if (typeof window === "undefined") return null;

  const savedUser = window.localStorage.getItem("user");

  if (!savedUser) return null;

  try {
    const parsedUser = JSON.parse(savedUser);

    if (!hasValidToken(parsedUser)) {
      window.localStorage.removeItem("user");
      window.sessionStorage.setItem("authRedirectReason", "expired");
      return null;
    }

    return parsedUser;
  } catch {
    window.sessionStorage.setItem("authRedirectReason", "expired");
    window.localStorage.removeItem("user");
    return null;
  }
};
