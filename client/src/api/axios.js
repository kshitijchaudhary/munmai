import axios from 'axios';
import { getApiBaseUrl } from './baseUrl';
import { isJwtExpired } from '../utils/authToken';

const BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: BASE_URL,
});

const isBrowser = () => typeof window !== "undefined";

const isLoginPage = () =>
  isBrowser() && window.location.pathname.replace(/\/+$/, "") === "/login";

const redirectToExpiredLogin = () => {
  if (!isBrowser()) return;

  window.localStorage.removeItem("user");
  window.sessionStorage.setItem("authRedirectReason", "expired");

  if (isLoginPage()) return;

  window.location.assign("/login?session=expired");
};

const isAuthTokenError = (error) => {
  if (![401, 403].includes(error.response?.status)) {
    return false;
  }

  const message = String(error.response?.data?.message || "").toLowerCase();

  return (
    message.includes("token") ||
    message.includes("jwt") ||
    message.includes("not authorized")
  );
};

// Attach token automatically
api.interceptors.request.use((config) => {
  if (!isBrowser()) {
    return config;
  }

  let user = null;

  try {
    const savedUser = window.localStorage.getItem("user");
    user = savedUser ? JSON.parse(savedUser) : null;
  } catch {
    window.localStorage.removeItem("user");
  }

  if (user?.token) {
    if (isJwtExpired(user.token)) {
      redirectToExpiredLogin();
      return Promise.reject(new axios.CanceledError("Session expired"));
    }

    config.headers.Authorization = `Bearer ${user.token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isAuthTokenError(error)) {
      redirectToExpiredLogin();
    }

    return Promise.reject(error);
  }
);

export default api;
