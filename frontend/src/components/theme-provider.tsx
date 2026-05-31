"use client";

import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "raven.theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  const mql = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  return mql?.matches ? "dark" : "light";
}

function applyTheme(pref: ThemePreference) {
  const root = document.documentElement;
  const resolved = pref === "system" ? getSystemTheme() : pref;
  root.dataset.theme = resolved;
  document.cookie = `raven.theme=${resolved};path=/;max-age=31536000;SameSite=Lax`;
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme?: "light" | "dark";
}) {
  const initialPref: ThemePreference = initialTheme === "light" || initialTheme === "dark" ? initialTheme : "system";
  const [theme, setThemeState] = useState<ThemePreference>(initialPref);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
    initialPref === "system" ? getSystemTheme() : initialPref
  );

  useLayoutEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    const pref = (saved === "light" || saved === "dark" || saved === "system") ? saved : initialPref;
    const resolved = pref === "system" ? getSystemTheme() : pref;
    setThemeState(pref);
    setResolvedTheme(resolved);
    applyTheme(pref);
  }, [initialPref]);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const resolved = media.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      applyTheme("system");
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    const resolved = next === "system" ? getSystemTheme() : next;
    setThemeState(next);
    setResolvedTheme(resolved);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [setTheme, resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
