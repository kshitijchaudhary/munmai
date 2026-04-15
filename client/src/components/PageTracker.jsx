import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackEvent } from "../utils/telemetry";

const PAGE_TITLES = {
  "/": "Finvexa - Dashboard",
  "/dashboard": "Finvexa - Dashboard",
  "/login": "Finvexa - Login",
  "/register": "Finvexa - Register",
  "/privacy": "Finvexa - Privacy Policy",
  "/terms": "Finvexa - Terms of Use",
  "/what-we-store": "Finvexa - What We Store",
};

const PageTracker = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = PAGE_TITLES[location.pathname] || "Finvexa";

    trackEvent("page_view", {
      search: location.search,
    });
  }, [location.pathname, location.search]);

  return null;
};

export default PageTracker;
