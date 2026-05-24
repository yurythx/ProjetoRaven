"use client";

import { useAuth as useAuthProvider } from "@/components/auth-provider";

export function useAuth() {
  return useAuthProvider();
}

