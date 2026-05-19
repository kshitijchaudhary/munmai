import { useTheme } from "../hooks/useTheme";

const ThemeToggle = ({ compact = false }) => {
  const { isDark, toggleTheme } = useTheme();
  const actionLabel = `Switch to ${isDark ? "Light" : "Dark"}`;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={`inline-flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 ${
        compact ? "px-3 py-2" : "w-full px-4 py-2.5"
      }`}
    >
      <span>{actionLabel}</span>
    </button>
  );
};

export default ThemeToggle;
