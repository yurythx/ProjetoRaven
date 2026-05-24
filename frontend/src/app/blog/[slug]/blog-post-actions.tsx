"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

type Props = {
  slug: string;
  status?: string;
  authorId?: string | null;
};

async function callAction(slug: string, action: string) {
  const res = await fetch(`/api/blog-admin/posts/${encodeURIComponent(slug)}/${action}/`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(body.detail ?? "Erro na operação");
  }
}

async function deletePost(slug: string) {
  const res = await fetch(`/api/blog-admin/posts/${encodeURIComponent(slug)}/`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao deletar post");
}

export function BlogPostActions({ slug, status, authorId }: Props) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const u = (user ?? null) as Record<string, unknown> | null;

  const isEditor = Boolean(u?.is_admin || u?.is_blog_editor) && !isLoading;
  const myId = typeof u?.id === "string" ? u.id : null;
  const isAuthor = Boolean(authorId && myId && authorId === myId);
  const canEdit = isEditor || isAuthor;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading || !canEdit || searchParams.get("preview") === "1") return null;

  async function handle(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rv-card p-4 flex flex-wrap items-center gap-3 border-[var(--rv-accent)]/20 bg-[var(--rv-accent)]/5">
      <span className="rv-label text-[9px] text-[var(--rv-accent)] tracking-[0.3em]">◈ PAINEL DO AUTOR</span>

      <div className="flex flex-wrap gap-2 ml-auto">
        <Link
          href={`/blog/${slug}/editar`}
          className="rv-btn rv-btn-ghost h-8 px-4 text-xs gap-1.5"
        >
          ✏ Editar
        </Link>

        {isEditor && status && (status === "draft" || status === "pending") && (
          <button
            onClick={() => handle(() => callAction(slug, "publish"))}
            disabled={busy}
            className="rv-btn rv-btn-primary h-8 px-4 text-xs disabled:opacity-50"
          >
            Publicar
          </button>
        )}

        {isEditor && status === "published" && (
          <button
            onClick={() => handle(() => callAction(slug, "archive"))}
            disabled={busy}
            className="h-8 px-4 text-xs rv-btn rv-btn-ghost border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 disabled:opacity-50"
          >
            Arquivar
          </button>
        )}

        {isEditor && (
          <>
            {confirmDelete && (
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={busy}
                className="h-8 px-3 text-xs rounded-xl bg-[var(--rv-surface-2)] border border-[var(--rv-border)] text-[var(--rv-text-dim)] hover:text-white hover:bg-white/5 transition-all disabled:opacity-40"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                handle(async () => {
                  await deletePost(slug);
                  router.push("/blog");
                });
              }}
              disabled={busy}
              className="h-8 px-3 text-xs rounded-xl bg-red-500/5 border border-red-500/20 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-40"
            >
              {confirmDelete ? "Confirmar" : "✕ Deletar"}
            </button>
          </>
        )}
      </div>

      {error && (
        <span className="w-full rv-label text-[9px] text-red-400">{error}</span>
      )}
    </div>
  );
}
