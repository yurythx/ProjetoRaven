"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw } from "lucide-react";

type Diagnostics = Record<string, unknown>;

export default function DiagnosticsPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-diagnostics"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/accounts-admin/admin/diagnostics/", { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<Diagnostics>;
    },
  });

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16">
      <div className="space-y-4 mb-10">
        <span className="rv-badge rv-badge-gold">◈ Sistema</span>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h1 className="rv-display text-4xl sm:text-6xl text-[var(--rv-text-primary)] tracking-tight">
            Diagnós<span className="text-[var(--rv-accent)]">ticos</span>
          </h1>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rv-btn rv-btn-ghost h-9 px-4 text-xs gap-2 flex items-center disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
        <p className="text-sm text-[var(--rv-text-muted)] max-w-2xl flex items-center gap-2">
          <Activity className="h-4 w-4 flex-shrink-0" />
          Visão de configurações e saúde do backend. Nenhum segredo é exposto.
        </p>
      </div>

      <div className="rv-card p-6">
        {isLoading || !data ? (
          <div className="flex items-center justify-center gap-3 py-12">
            <div className="h-5 w-5 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
            <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">AGUARDANDO SERVIDOR...</span>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap break-words text-xs text-[var(--rv-text-muted)] font-mono leading-relaxed">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
