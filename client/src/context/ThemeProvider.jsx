import { useEffect, useMemo, useState } from "react";
import {
  applyThemeClass,
  getInitialTheme,
  THEME_STORAGE_KEY,
  ThemeContext,
  themes,
} from "./themeContext";

const ThemeProvider = ({ children }) => {
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

export default ThemeProvider;
