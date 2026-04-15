import { Link } from "react-router-dom";

const LegalFooter = () => (
  <div className="mt-6 text-xs text-slate-500 text-center flex flex-wrap items-center justify-center gap-3">
    <Link to="/privacy" className="hover:text-slate-700 hover:underline">
      Privacy
    </Link>
    <Link to="/terms" className="hover:text-slate-700 hover:underline">
      Terms
    </Link>
    <Link to="/what-we-store" className="hover:text-slate-700 hover:underline">
      What We Store
    </Link>
  </div>
);

export default LegalFooter;
