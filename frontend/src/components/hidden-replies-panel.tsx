"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { sanitizeRichTextHtml } from "@/lib/sanitize-html";

type Reply = {
  id: string;
  content: string;
  is_hidden: boolean;
  hidden_reason?: string | null;
  created_at: string;
  author: { username: string; display_name: string };
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export function HiddenRepliesPanel({ topicSlug }: { topicSlug: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [hidden, setHidden] = useState<Reply[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isModerator = useMemo(() => {
    const u = (user ?? null) as Record<string, unknown> | null;
    return Boolean(u?.["is_forum_moderator"] || u?.["is_admin"]);
  }, [user]);

  useEffect(() => {
    if (!isModerator) return;
    (async () => {
      setError(null);
      setIsLoading(true);
      const res = await fetch(`/api/forum/replies?topic=${encodeURIComponent(topicSlug)}&include_hidden=1&page=1&page_size=100`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      setIsLoading(false);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.detail === "string"
              ? data.detail
              : "Falha ao carregar replies ocultas.";
        setError(message);
        return;
      }
      const results = (data?.results ?? (data as Paginated<Reply>).results ?? []) as Reply[];
      setHidden(results.filter((r) => r.is_hidden));
    })();
  }, [isModerator, topicSlug]);

  if (!isModerator) return null;

  return (
    <div className="mt-6 rounded-2xl border border-foreground/10 bg-background p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm font-semibold text-foreground">Replies ocultas</div>
        <div className="text-xs text-foreground/60">{isLoading ? "Carregando..." : `${hidden.length}`}</div>
      </div>

      {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}

      <div className="mt-4 grid gap-3">
        {hidden.map((r) => (
          <div key={r.id} className="rounded-2xl border border-foreground/10 bg-background p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-medium text-foreground/70">{r.author.display_name || r.author.username}</div>
              <div className="text-xs text-foreground/60" suppressHydrationWarning>{new Date(r.created_at).toLocaleString("pt-BR")}</div>
            </div>
            <div
              className="prose prose-sm sm:prose-base dark:prose-invert mt-3 max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(r.content) }}
            />
            <div className="mt-3">
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch(`/api/forum/replies/${encodeURIComponent(r.id)}/unhide`, {
                    method: "POST",
                    headers: { Accept: "application/json" },
                  });
                  if (res.ok) {
                    setHidden((prev) => prev.filter((x) => x.id !== r.id));
                    router.refresh();
                    return;
                  }
                  const data = await res.json().catch(() => null);
                  const message =
                    typeof data?.error === "string"
                      ? data.error
                      : typeof data?.detail === "string"
                        ? data.detail
                        : "Falha ao desocultar reply.";
                  setError(message);
                }}
                className="h-9 rounded-xl border border-foreground/15 bg-background px-3 text-xs font-medium text-foreground"
              >
                Desocultar
              </button>
            </div>
          </div>
        ))}

        {!isLoading && hidden.length === 0 && !error ? (
          <div className="text-sm text-foreground/70">Nenhuma reply oculta.</div>
        ) : null}
      </div>
    </div>
  );
}
