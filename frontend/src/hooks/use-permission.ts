"use client";

import { useCallback } from "react";

import { useAuth } from "@/components/auth-provider";

export function usePermission() {
  const { user } = useAuth();

  const hasPermission = useCallback(
    (permission: string) => {
      const u = (user ?? null) as Record<string, unknown> | null;
      const permissions = Array.isArray(u?.["permissions"]) ? (u?.["permissions"] as unknown[]) : [];
      return permissions.includes(permission);
    },
    [user]
  );

  return { hasPermission };
}

