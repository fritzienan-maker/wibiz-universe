// ─── Theme persistence ────────────────────────────────────────────────────────
// Reads/writes the preferred theme from localStorage and applies it to <html>.
// Usage: const { theme, toggle } = useTheme();

import { useState, useEffect } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "wibiz-theme";

function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored ?? "dark";
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggle };
}
