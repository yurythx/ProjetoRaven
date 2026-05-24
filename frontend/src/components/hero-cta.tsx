"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";

export function HeroCta() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
        <div className="h-12 sm:h-14 w-44 rounded-xl bg-white/5 animate-pulse" />
        <div className="h-12 sm:h-14 w-36 rounded-xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
        <Link
          href="/blog"
          className="rv-btn rv-btn-primary text-xs sm:text-sm px-8 sm:px-10 h-12 sm:h-14 gap-2 w-full sm:w-auto max-w-xs"
        >
          <span>✦</span> Ir para o Blog
        </Link>
        <Link
          href="/forum"
          className="rv-btn rv-btn-ghost text-xs sm:text-sm px-6 sm:px-8 h-12 sm:h-14 gap-2 w-full sm:w-auto max-w-xs"
        >
          <span className="text-[var(--rv-cyan)]">◈</span> Explorar Fórum
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
      <Link
        href="/register"
        className="rv-btn rv-btn-primary text-xs sm:text-sm px-8 sm:px-10 h-12 sm:h-14 gap-2 w-full sm:w-auto max-w-xs"
      >
        <span>⚡</span> Criar Conta
      </Link>
      <Link
        href="/forum"
        className="rv-btn rv-btn-ghost text-xs sm:text-sm px-6 sm:px-8 h-12 sm:h-14 gap-2 w-full sm:w-auto max-w-xs"
      >
        <span className="text-[var(--rv-cyan)]">◈</span> Explorar Fórum
      </Link>
    </div>
  );
}
