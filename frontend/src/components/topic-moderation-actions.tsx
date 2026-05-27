"use client";

import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";

export function TopicModerationActions({
  slug,
  isPinned,
  isLocked,
  status,
}: {
  slug: string;
  isPinned: boolean;
  isLocked: boolean;
  status: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isModerator = useMemo(() => {
    const u = (user ?? null) as Record<string, unknown> | null;
    return Boolean(u?.["is_forum_moderator"] || u?.["is_admin"]);
  }, [user]);

  if (!isModerator) return null;

  async function action(path: string) {
    setError(null);
    setIsSubmitting(true);
    const res = await fetch(path, { method: "POST", headers: { Accept: "application/json" } });
    setIsSubmitting(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(
        typeof data?.error === "string" ? data.error
        : typeof data?.detail === "string" ? data.detail
        : "Falha ao executar ação."
      );
      return;
    }
    router.refresh();
  }

  const canClose   = !isLocked && status !== "archived";
  const canOpen    = isLocked  && status !== "archived";
  const canArchive = status !== "archived";

  return (
    <div className="rv-card mt-6 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rv-text-muted)] mb-3">
        Moderação
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => action(`/api/forum/topics/${encodeURIComponent(slug)}/${isPinned ? "unpin" : "pin"}`)}
          className={`rv-btn h-8 px-3 text-xs rounded-lg border transition-all
            ${isPinned
              ? "border-[var(--rv-accent)]/50 bg-[var(--rv-accent)]/10 text-[var(--rv-accent)]"
              : "border-[var(--rv-border)] text-[var(--rv-text-muted)]"}
            hover:border-[var(--rv-accent)]/60 hover:bg-[var(--rv-accent)]/10 disabled:opacity-40`}
        >
          {isPinned ? "📌 Desfixar" : "📌 Fixar"}
        </button>

        {canClose && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => action(`/api/forum/topics/${encodeURIComponent(slug)}/close`)}
            className="rv-btn h-8 px-3 text-xs rounded-lg border border-[var(--rv-border)] text-[var(--rv-text-muted)] hover:border-amber-500/60 hover:bg-amber-500/10 hover:text-amber-500 disabled:opacity-40 transition-all"
          >
            🔒 Fechar
          </button>
        )}

        {canOpen && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => action(`/api/forum/topics/${encodeURIComponent(slug)}/open`)}
            className="rv-btn h-8 px-3 text-xs rounded-lg border border-[var(--rv-border)] text-[var(--rv-text-muted)] hover:border-green-500/60 hover:bg-green-500/10 hover:text-green-500 disabled:opacity-40 transition-all"
          >
            🔓 Reabrir
          </button>
        )}

        {canArchive && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => action(`/api/forum/topics/${encodeURIComponent(slug)}/archive`)}
            className="rv-btn h-8 px-3 text-xs rounded-lg border border-[var(--rv-border)] text-[var(--rv-text-muted)] hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40 transition-all"
          >
            🗄️ Arquivar
          </button>
        )}
      </div>

      <p className="mt-3 text-[11px] text-[var(--rv-text-dim)]">
        Status: <span className="font-medium">{status}</span>
        {" · "}
        {isLocked ? "🔒 fechado" : "🔓 aberto"}
        {" · "}
        {isPinned ? "📌 fixado" : "normal"}
      </p>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
