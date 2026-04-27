const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

const trimTrailingSlash = (value = "") => String(value).replace(/\/+$/, "");

const addApiSuffix = (value = "") => {
  const normalizedValue = trimTrailingSlash(value);

  if (!normalizedValue) {
    return "";
  }

  return normalizedValue.endsWith("/api")
    ? normalizedValue
    : `${normalizedValue}/api`;
};

export const getApiBaseUrl = () => {
  const configuredBaseUrl = trimTrailingSlash(import.meta.env.VITE_API_URL);

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (typeof window !== "undefined") {
    if (LOCAL_HOSTNAMES.has(window.location.hostname)) {
      return "http://localhost:5000/api";
    }

    if (import.meta.env.PROD) {
      throw new Error("VITE_API_URL must be configured for production builds.");
    }

    return addApiSuffix(window.location.origin);
  }

  return "http://localhost:5000/api";
};

export const getAssetBaseUrl = () =>
  trimTrailingSlash(getApiBaseUrl()).replace(/\/api$/, "");
