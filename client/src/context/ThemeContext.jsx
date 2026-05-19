import { createContext, useContext, useEffect, useMemo, useState } from "react";

const THEME_STORAGE_KEY = "munmai-theme";
const themes = new Set(["light", "dark"]);

const getInitialTheme = () => {
  if (typeof window === "undefined") return "light";

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (themes.has(storedTheme)) {
    return storedTheme;
  }

  return "light";
};

const applyThemeClass = (theme) => {
  if (typeof document === "undefined") return;

  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
};

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyThemeClass(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme: (nextTheme) => {
        if (themes.has(nextTheme)) {
          setTheme(nextTheme);
        }
      },
      toggleTheme: () => {
        setTheme((currentTheme) =>
          currentTheme === "dark" ? "light" : "dark"
        );
      },
    }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
};
