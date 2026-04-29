import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackEvent } from "../utils/telemetry";

const PAGE_TITLES = {
  "/": "Munmai - Dashboard",
  "/dashboard": "Munmai - Dashboard",
  "/groups": "Munmai - Groups",
  "/login": "Munmai - Login",
  "/register": "Munmai - Register",
  "/forgot-password": "Munmai - Forgot Password",
  "/privacy": "Munmai - Privacy Policy",
  "/terms": "Munmai - Terms of Use",
  "/what-we-store": "Munmai - What We Store",
};

const getPageTitle = (pathname) => {
  if (pathname.startsWith("/reset-password/")) {
    return "Munmai - Reset Password";
  }

  if (pathname.startsWith("/groups/")) {
    return "Munmai - Group Detail";
  }

  return PAGE_TITLES[pathname] || "Munmai";
};

const PageTracker = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = getPageTitle(location.pathname);

    trackEvent("page_view", {
      search: location.search,
    });
  }, [location.pathname, location.search]);

  return null;
};

export default PageTracker;
