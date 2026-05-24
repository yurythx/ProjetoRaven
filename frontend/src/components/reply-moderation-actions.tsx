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
      headers: json ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
      body: json ? JSON.stringify(json) : undefined,
    });
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

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={async () =>
            action(`/api/forum/replies/${encodeURIComponent(replyId)}/${isSolution ? "unmark-solution" : "mark-solution"}`)
          }
          className="h-9 rounded-xl border border-foreground/15 bg-background px-3 text-xs font-medium text-foreground disabled:opacity-60"
        >
          {isSolution ? "Desmarcar solução" : "Marcar solução"}
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={async () =>
            action(
              `/api/forum/replies/${encodeURIComponent(replyId)}/${isHidden ? "unhide" : "hide"}`,
              isHidden ? undefined : { reason: "moderado" }
            )
          }
          className="h-9 rounded-xl border border-foreground/15 bg-background px-3 text-xs font-medium text-foreground disabled:opacity-60"
        >
          {isHidden ? "Desocultar" : "Ocultar"}
        </button>
      </div>
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  );
}
