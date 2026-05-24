"use client";

import React, { useMemo } from "react";

import { useAuth } from "@/components/auth-provider";
import { usePermission } from "@/hooks/use-permission";

export function Protected({
  children,
  requiredPermissions,
}: {
  children: React.ReactNode;
  requiredPermissions?: string[];
}) {
  const { user, isLoading } = useAuth();
  const { hasPermission } = usePermission();

  const ok = useMemo(() => {
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    return requiredPermissions.every((p) => hasPermission(p));
  }, [hasPermission, requiredPermissions]);

  if (isLoading) return null;
  if (!user) return null;
  if (!ok) return null;

  return <>{children}</>;
}

