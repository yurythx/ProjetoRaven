"use client";

import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";

export function ReplyModerationActions({
  replyId,
  isSolution,
  isHidden,
}: {
  replyId: string;
  isSolution: boolean;
  isHidden: boolean;
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

  async function action(path: string, json?: unknown) {
    setError(null);
    setIsSubmitting(true);
    const res = await fetch(path, {
      method: "POST",
      headers: json
        ? { "Content-Type": "application/json", Accept: "application/json" }
        : { Accept: "application/json" },
      body: json ? JSON.stringify(json) : undefined,
    });
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

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() =>
          action(
            `/api/forum/replies/${encodeURIComponent(replyId)}/${isSolution ? "unmark-solution" : "mark-solution"}`
          )
        }
        className={`rv-btn h-7 px-2.5 text-[11px] rounded-lg border transition-all
          ${isSolution
            ? "border-green-500/50 bg-green-500/10 text-green-500"
            : "border-[var(--rv-border)] text-[var(--rv-text-muted)] hover:border-green-500/50 hover:bg-green-500/10 hover:text-green-500"}
          disabled:opacity-40`}
      >
        {isSolution ? "✅ Desmarcar solução" : "✅ Marcar solução"}
      </button>

      <button
        type="button"
        disabled={isSubmitting}
        onClick={() =>
          action(
            `/api/forum/replies/${encodeURIComponent(replyId)}/${isHidden ? "unhide" : "hide"}`,
            isHidden ? undefined : { reason: "moderado" }
          )
        }
        className={`rv-btn h-7 px-2.5 text-[11px] rounded-lg border transition-all
          ${isHidden
            ? "border-[var(--rv-border)] text-[var(--rv-text-muted)] hover:border-[var(--rv-accent)]/50 hover:bg-[var(--rv-accent)]/10 hover:text-[var(--rv-accent)]"
            : "border-red-500/40 bg-red-500/10 text-red-400 hover:border-red-500/60 hover:bg-red-500/15"}
          disabled:opacity-40`}
      >
        {isHidden ? "👁️ Desocultar" : "🙈 Ocultar"}
      </button>

      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
