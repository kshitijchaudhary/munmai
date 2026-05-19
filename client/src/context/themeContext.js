import { createContext } from "react";

export const THEME_STORAGE_KEY = "munmai-theme";
export const themes = new Set(["light", "dark"]);
export const ThemeContext = createContext(null);

export const getInitialTheme = () => {
  if (typeof window === "undefined") return "light";

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (themes.has(storedTheme)) {
    return storedTheme;
  }

  return "light";
};

export const applyThemeClass = (theme) => {
  if (typeof document === "undefined") return;

  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
};
