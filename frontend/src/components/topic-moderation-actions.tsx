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
      const message =
        typeof data?.error === "string"
          ? data.error
          : typeof data?.detail === "string"
            ? data.detail
            : "Falha ao executar ação.";
      setError(message);
      return;
    }
    router.refresh();
  }

  const canArchive = status !== "archived";
  const canClose = !isLocked && status !== "archived";
  const canOpen = isLocked && status !== "archived";

  return (
    <div className="mt-6 rounded-2xl border border-foreground/10 bg-background p-5">
      <div className="text-sm font-semibold text-foreground">Moderação</div>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={async () => action(`/api/forum/topics/${encodeURIComponent(slug)}/${isPinned ? "unpin" : "pin"}`)}
          className="h-10 rounded-xl border border-foreground/15 bg-background px-4 text-sm font-medium text-foreground disabled:opacity-60"
        >
          {isPinned ? "Desfixar" : "Fixar"}
        </button>
        <button
          type="button"
          disabled={isSubmitting || !canClose}
          onClick={async () => action(`/api/forum/topics/${encodeURIComponent(slug)}/close`)}
          className="h-10 rounded-xl border border-foreground/15 bg-background px-4 text-sm font-medium text-foreground disabled:opacity-60"
        >
          Fechar
        </button>
        <button
          type="button"
          disabled={isSubmitting || !canOpen}
          onClick={async () => action(`/api/forum/topics/${encodeURIComponent(slug)}/open`)}
          className="h-10 rounded-xl border border-foreground/15 bg-background px-4 text-sm font-medium text-foreground disabled:opacity-60"
        >
          Reabrir
        </button>
        <button
          type="button"
          disabled={isSubmitting || !canArchive}
          onClick={async () => action(`/api/forum/topics/${encodeURIComponent(slug)}/archive`)}
          className="h-10 rounded-xl border border-foreground/15 bg-background px-4 text-sm font-medium text-foreground disabled:opacity-60"
        >
          Arquivar
        </button>
      </div>
      <div className="mt-3 text-xs text-foreground/60">
        Status: {status} · {isLocked ? "fechado" : "aberto"} · {isPinned ? "fixado" : "normal"}
      </div>
      {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
    </div>
  );
}
