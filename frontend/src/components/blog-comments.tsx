"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/components/auth-provider";

type Comment = {
  id: string;
  content: string;
  author_name: string | null;
  name: string | null;
  post: string;
  parent: string | null;
  reply_count: number;
  created_at: string;
};

export function BlogComments({ postId, postSlug }: { postId: string; postSlug: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canComment = useMemo(() => {
    const u = (user ?? null) as Record<string, unknown> | null;
    if (!u) return false;
    const isVerified = Boolean(u["is_verified"]);
    const isActive = u["is_active"] === undefined ? true : Boolean(u["is_active"]);
    const isBanned = Boolean(u["is_banned"]);
    return isVerified && isActive && !isBanned;
  }, [user]);

  const load = useCallback(async (signal?: AbortSignal, attempt = 1): Promise<void> => {
    setError(null);
    setIsLoading(true);
    let res: Response;
    try {
      res = await fetch(`/api/blog/comments?post_slug=${encodeURIComponent(postSlug)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal,
      });
    } catch (err) {
      setIsLoading(false);
      if ((err as { name?: string }).name !== "AbortError") {
        setError("Não foi possível carregar os comentários.");
      }
      return;
    }
    // Retry up to 2x on server errors (handles dev cold-start compilation delay)
    if (res.status >= 500 && attempt < 3) {
      await new Promise<void>((r) => setTimeout(r, attempt * 1500));
      if (signal?.aborted) return;
      return load(signal, attempt + 1);
    }
    setIsLoading(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError("Não foi possível carregar os comentários.");
      return;
    }
    const items = Array.isArray(data)
      ? (data as Comment[])
      : Array.isArray((data as { results?: unknown })?.results)
        ? ((data as { results: Comment[] }).results ?? [])
        : [];
    setComments(items);
  }, [postSlug]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch(() => null);
    return () => controller.abort();
  }, [load]);

  return (
    <div className="mt-8 rounded-2xl border border-foreground/10 bg-background p-5" aria-busy={isLoading}>
      <div className="text-base font-semibold text-foreground">Comentários</div>

      {isLoading ? <div className="mt-3 text-sm text-foreground/70">Carregando...</div> : null}
      {error ? (
        <div className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3">
        {comments.map((c) => (
          <div key={c.id} className="rounded-2xl border border-foreground/10 bg-background p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-medium text-foreground/70">{c.author_name || c.name || "Anônimo"}</div>
              <div className="text-xs text-foreground/60">{new Date(c.created_at).toLocaleString("pt-BR")}</div>
            </div>
            <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground">{c.content}</pre>
          </div>
        ))}
        {!isLoading && comments.length === 0 && !error ? (
          <div className="text-sm text-foreground/70">Nenhum comentário ainda.</div>
        ) : null}
      </div>

      {!user ? (
        <div className="mt-8 rounded-xl border border-foreground/10 bg-background p-4 text-sm text-foreground/80">
          Faça <Link href="/login" className="underline">login</Link> para comentar.
        </div>
      ) : !canComment ? (
        <div className="mt-8 rounded-xl border border-foreground/10 bg-background p-4 text-sm text-foreground/80">
          Sua conta precisa estar ativa para comentar.
        </div>
      ) : (
        <form
          className="mt-8 grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            if (content.trim().length < 3) {
              setError("Escreva um comentário maior.");
              return;
            }
            if (!canComment) {
              setError("Você não tem permissão para comentar.");
              return;
            }
            setIsSubmitting(true);
            let res: Response | null = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                res = await fetch("/api/blog/comments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Accept: "application/json" },
                  body: JSON.stringify({
                    post: postId,
                    post_slug: postSlug,
                    content: content.trim(),
                  }),
                });
                if (res.status < 500) break;
              } catch { /* network error — fall through to retry */ }
              if (attempt < 3) await new Promise<void>((r) => setTimeout(r, attempt * 1500));
            }
            setIsSubmitting(false);
            if (!res) { setError("Falha ao enviar comentário."); return; }
            const data = await res.json().catch(() => null);
            if (!res.ok) {
              setError(typeof (data as Record<string,unknown>)?.error === "string" ? String((data as Record<string,unknown>).error) : "Falha ao enviar comentário.");
              return;
            }
            setContent("");
            await load();
          }}
        >
          <div className="text-sm font-semibold text-foreground">Deixe um comentário</div>
          <label htmlFor="blog-comment" className="grid gap-1 text-sm">
            <span className="font-medium text-foreground">Comentário</span>
            <textarea
              id="blog-comment"
              name="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full resize-y rounded-xl border border-foreground/15 bg-background p-3 text-sm text-foreground"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 rounded-xl bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
          >
            {isSubmitting ? "Enviando..." : "Enviar"}
          </button>
        </form>
      )}
    </div>
  );
}
