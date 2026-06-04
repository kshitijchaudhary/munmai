import { useState } from "react";
import { AuthContext, getStoredUser } from "./authContext";
import { hasValidToken } from "../utils/authToken";

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser);

  const login = (userData) => {
    if (!hasValidToken(userData)) {
      localStorage.removeItem("user");
      sessionStorage.setItem("authRedirectReason", "expired");
      setUser(null);
      return;
    }

    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
