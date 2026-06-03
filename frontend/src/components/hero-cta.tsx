"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useState } from "react";

export function HeroCta() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
        <div className="h-12 sm:h-14 w-44 rounded-xl bg-white/5 animate-pulse" />
        <div className="h-12 sm:h-14 w-36 rounded-xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  const SearchBlock = (
    <div className="w-full max-w-xl">
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Buscar artigos e tópicos..."
          className="rv-input h-12 sm:h-14 pl-5 pr-28 text-sm sm:text-base w-full rounded-2xl"
          aria-label="Busca global"
        />
        <button
          type="button"
          onClick={submit}
          className="rv-btn rv-btn-primary h-10 sm:h-11 px-5 text-[10px] sm:text-xs absolute right-2 top-1/2 -translate-y-1/2"
        >
          Buscar
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {["docker", "deploy", "csp", "next.js"].map((s) => (
          <Link
            key={s}
            href={`/search?q=${encodeURIComponent(s)}`}
            className="rv-badge rv-badge-cyan text-[8px] hover:opacity-90 transition-opacity"
          >
            {s}
          </Link>
        ))}
      </div>
    </div>
  );

  if (user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 sm:gap-5">
        {SearchBlock}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full">
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
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 sm:gap-5">
      {SearchBlock}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full">
        <Link
          href="/blog"
          className="rv-btn rv-btn-primary text-xs sm:text-sm px-8 sm:px-10 h-12 sm:h-14 gap-2 w-full sm:w-auto max-w-xs"
        >
          <span>✦</span> Explorar Blog
        </Link>
        <Link
          href="/forum"
          className="rv-btn rv-btn-ghost text-xs sm:text-sm px-6 sm:px-8 h-12 sm:h-14 gap-2 w-full sm:w-auto max-w-xs"
        >
          <span className="text-[var(--rv-cyan)]">◈</span> Explorar Fórum
        </Link>
      </div>
    </div>
  );
}
