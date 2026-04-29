import { useContext, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const futureItems = new Set([
  "Monthly Summary",
  "Opening Balance",
  "Liabilities",
  "Settings",
]);

const getGroupDestination = (pathname) =>
  /^\/groups\/[^/]+\/summary$/.test(pathname) ? pathname : "/groups";

const getNavSections = (pathname) => [
  {
    label: "Main",
    items: [{ label: "Dashboard", to: "/dashboard" }],
  },
  {
    label: "Money",
    items: [
      { label: "Add Transaction", to: "/money/transactions#add-transaction" },
      { label: "Expenses", to: "/money/transactions?type=expense" },
      { label: "Income", to: "/money/transactions?type=income" },
      { label: "Receipts", to: "/money/receipts" },
    ],
  },
  {
    label: "Groups",
    items: [
      { label: "My Groups", to: "/groups" },
      { label: "Invitations", to: "/group-invitations" },
      { label: "Shared Expenses", to: getGroupDestination(pathname), status: "In Group" },
      { label: "Settlements", to: getGroupDestination(pathname), status: "In Group" },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Tax Pack", to: "/money/tax-pack" },
      { label: "Monthly Summary", status: "Coming Soon" },
    ],
  },
  {
    label: "Financial Life",
    items: [
      { label: "Opening Balance", status: "Coming Soon" },
      { label: "Liabilities", status: "Coming Soon" },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Profile", to: "/profile" },
      { label: "Settings", status: "Coming Soon" },
    ],
  },
];

const isActiveItem = (pathname, search, hash, item) => {
  if (!item.to || futureItems.has(item.label)) {
    return false;
  }

  if (item.status === "In Group") {
    return false;
  }

  const [targetUrl, targetHash = ""] = item.to.split("#");
  const [targetPath, targetSearch = ""] = targetUrl.split("?");

  if (targetPath === "/dashboard") {
    return pathname === "/dashboard" && (!targetHash || hash === `#${targetHash}`);
  }

  if (targetPath === "/money/transactions") {
    return (
      pathname === "/money/transactions" &&
      (!targetSearch || search === `?${targetSearch}`) &&
      (!targetHash || hash === `#${targetHash}`)
    );
  }

  if (targetPath === "/groups") {
    return pathname === "/groups" || pathname.startsWith("/groups/");
  }

  return pathname === targetPath;
};

const NavItem = ({ item, onNavigate }) => {
  const { pathname, search, hash } = useLocation();
  const active = isActiveItem(pathname, search, hash, item);
  const disabled = !item.to || futureItems.has(item.label);

  if (disabled) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-slate-400">
        <span className="font-semibold">{item.label}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-400">
          {item.status || "Coming Soon"}
        </span>
      </div>
    );
  }

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      <span>{item.label}</span>
      {item.status && (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
            active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-400"
          }`}
        >
          {item.status}
        </span>
      )}
    </Link>
  );
};

const SidebarContent = ({ onNavigate }) => {
  const { pathname } = useLocation();
  const { logout } = useContext(AuthContext);
  const sections = useMemo(() => getNavSections(pathname), [pathname]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6">
        <Link to="/dashboard" onClick={onNavigate} className="text-2xl font-black text-indigo-600">
          Munmai
        </Link>
        <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Money OS
        </p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto pr-1">
        {sections.map((section) => (
          <section key={section.label}>
            <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
              {section.label}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavItem
                  key={`${section.label}-${item.label}`}
                  item={item}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <button
        type="button"
        onClick={logout}
        className="mt-6 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-95"
      >
        Sign Out
      </button>
    </div>
  );
};

const Sidebar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white px-4 py-6 lg:block">
        <SidebarContent />
      </aside>

      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link to="/dashboard" className="text-xl font-black text-indigo-600">
            Munmai
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
          >
            {mobileOpen ? "Close" : "Menu"}
          </button>
        </div>

        {mobileOpen && (
          <div className="mt-4 max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-100 bg-white p-4 shadow-xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;
