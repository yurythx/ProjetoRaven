"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { jsonFetch } from "@/lib/fetch";

type AuthUser = Record<string, unknown>;

type LoginResult =
  | { ok: true }
  | { ok: false; error: unknown }
  | { ok: true; totp_required: true; totp_token: string };

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (payload: Record<string, unknown>) => Promise<LoginResult>;
  register: (payload: Record<string, unknown>) => Promise<{ ok: true } | { ok: false; error: unknown }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const result = await jsonFetch<{ user: AuthUser } | null>("/api/auth/session", { method: "GET" });
    setUser(result.data?.user ?? null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refreshSession();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshSession]);

  // Proactively renew the access token every 25 min (token expires in 30 min).
  // Skip when not logged in; ignore 503 (backend temporarily unavailable) silently.
  useEffect(() => {
    const id = setInterval(async () => {
      if (!user) return;
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST" });
        if (res.status === 401) setUser(null);
      } catch {
        // Network error — will retry next interval
      }
    }, 25 * 60 * 1000);
    return () => clearInterval(id);
  }, [user]);

  const login = useCallback(async (payload: Record<string, unknown>): Promise<LoginResult> => {
    const result = await jsonFetch<{ user?: AuthUser; totp_required?: true; totp_token?: string } | null>(
      "/api/auth/login",
      { method: "POST", json: payload },
    );
    if (!result.ok) return { ok: false as const, error: result.data };
    if (result.data?.totp_required) {
      return { ok: true as const, totp_required: true, totp_token: result.data.totp_token! };
    }
    setUser(result.data?.user ?? null);
    return { ok: true as const };
  }, []);

  const register = useCallback(async (payload: Record<string, unknown>) => {
    const result = await jsonFetch<{ user: AuthUser } | null>("/api/auth/register", { method: "POST", json: payload });
    if (!result.ok) return { ok: false as const, error: result.data };
    setUser(result.data?.user ?? null);
    return { ok: true as const };
  }, []);

  const logout = useCallback(async () => {
    await jsonFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, register, logout, refreshSession }),
    [user, isLoading, login, register, logout, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

