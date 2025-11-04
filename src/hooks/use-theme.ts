import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("causal_theme");
    return (saved as Theme) || "system";
  });

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (themeToApply: "light" | "dark") => {
      root.classList.remove("light", "dark");
      root.classList.add(themeToApply);
    };

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      applyTheme(systemTheme);

      // Listen for system theme changes
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? "dark" : "light");
      };
      mediaQuery.addEventListener("change", handleChange);

      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      applyTheme(theme);
    }

    localStorage.setItem("causal_theme", theme);
  }, [theme]);

  return { theme, setTheme };
}
