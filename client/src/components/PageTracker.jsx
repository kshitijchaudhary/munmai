import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackEvent } from "../utils/telemetry";

const PAGE_TITLES = {
  "/": "Munmai - Dashboard",
  "/dashboard": "Munmai - Dashboard",
  "/login": "Munmai - Login",
  "/register": "Munmai - Register",
  "/privacy": "Munmai - Privacy Policy",
  "/terms": "Munmai - Terms of Use",
  "/what-we-store": "Munmai - What We Store",
};

const PageTracker = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = PAGE_TITLES[location.pathname] || "Munmai";

    trackEvent("page_view", {
      search: location.search,
    });
  }, [location.pathname, location.search]);

  return null;
};

export default PageTracker;
