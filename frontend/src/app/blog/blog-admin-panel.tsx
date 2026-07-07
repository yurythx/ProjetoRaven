"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type AdminPost = {
  id: string;
  title: string;
  slug: string;
  author_name: string;
  category_name: string;
  status: "draft" | "pending" | "published" | "archived" | "rejected" | "scheduled";
  published_at: string | null;
  created_at: string;
  view_count: number;
};

type Paginated = { count: number; next: string | null; results: AdminPost[] };

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", pending: "Revisão", published: "Publicado",
  archived: "Arquivado", rejected: "Rejeitado", scheduled: "Agendado",
};
const STATUS_BADGE: Record<string, string> = {
  draft: "rv-badge-purple", pending: "rv-badge-gold", published: "rv-badge-cyan",
  archived: "rv-badge-red", rejected: "rv-badge-red", scheduled: "rv-badge-purple",
};

async function fetchAdminPosts(page: number, search: string): Promise<Paginated> {
  const qs = new URLSearchParams({ page: String(page), page_size: "15", ordering: "-updated_at" });
  if (search) qs.set("search", search);
  const res = await fetch(`/api/blog-admin/posts/?${qs}`);
  if (!res.ok) throw new Error("Erro ao carregar posts");
  return res.json();
}

async function actionPost(slug: string, action: string) {
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

export function BlogAdminPanel() {
  const { user, isLoading } = useAuth();
  const u = (user ?? null) as Record<string, unknown> | null;
  const isEditor = Boolean(u?.is_admin || u?.is_blog_editor || u?.is_staff || u?.is_superuser) && !isLoading;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [confirmDeleteSlug, setConfirmDeleteSlug] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isFetching } = useQuery<Paginated>({
    queryKey: ["blog-admin-posts", page, search],
    queryFn: () => fetchAdminPosts(page, search),
    enabled: isEditor,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["blog-admin-posts"] });

  const publishMutation = useMutation({ mutationFn: (slug: string) => actionPost(slug, "publish"), onSuccess: invalidate });
  const archiveMutation = useMutation({ mutationFn: (slug: string) => actionPost(slug, "archive"), onSuccess: invalidate });
  const deleteMutation = useMutation({
    mutationFn: deletePost,
    onSuccess: () => { setConfirmDeleteSlug(null); invalidate(); },
  });

  if (!isEditor) return null;

  const posts = data?.results ?? [];
  const totalPages = data ? Math.ceil(data.count / 15) : 1;

  return (
    <section className="relative z-10 mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="rv-divider mb-10" />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="rv-badge rv-badge-purple">◈ Gestão de Conteúdo</span>
        </div>
        <Link href="/blog/novo" className="rv-btn rv-btn-primary text-xs px-6 h-9 gap-2 flex-shrink-0">
          <span>+</span> Novo Post
        </Link>
      </div>

      {/* ── Posts ── */}
      {(
        <>
          <form
            onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }}
            className="rv-card p-3 flex gap-2 mb-4 bg-[var(--rv-surface-2)]/40"
          >
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por título, autor..."
              className="rv-input h-9 text-xs flex-1"
            />
            <button type="submit" className="rv-btn rv-btn-ghost h-9 px-4 text-xs">Buscar</button>
            {search && (
              <button type="button" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }} className="rv-btn rv-btn-ghost h-9 px-4 text-xs text-[var(--rv-text-dim)]">
                Limpar
              </button>
            )}
          </form>

          <div className="rv-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-[var(--rv-border)]">
                    {["TÍTULO", "CATEGORIA", "STATUS", "DATA", "AÇÕES"].map((h) => (
                      <th key={h} className="px-5 py-3 rv-label text-[9px] text-[var(--rv-text-dim)] tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rv-border)]">
                  {isFetching ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <div className="h-5 w-5 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
                          <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">CARREGANDO...</span>
                        </div>
                      </td>
                    </tr>
                  ) : posts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-[var(--rv-text-dim)] text-xs">
                        Nenhum post encontrado.
                      </td>
                    </tr>
                  ) : posts.map((p) => (
                    <tr key={p.id} className="group hover:bg-white/[0.01] transition-colors">
                      <td className="px-5 py-4 max-w-[260px]">
                        <Link href={`/blog/${p.slug}`} className="text-[var(--rv-text-primary)] text-xs font-medium hover:text-[var(--rv-accent)] transition-colors line-clamp-2">
                          {p.title}
                        </Link>
                        <span className="block text-[9px] text-[var(--rv-text-dim)] mt-0.5">por {p.author_name}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rv-label text-[9px] px-2 py-0.5 rounded-md bg-[var(--rv-surface-2)] border border-[var(--rv-border)] text-[var(--rv-text-muted)]">
                          {p.category_name || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rv-badge text-[9px] ${STATUS_BADGE[p.status] ?? "rv-badge-purple"}`}>
                          {STATUS_LABEL[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[10px] text-[var(--rv-text-dim)]">
                          {format(new Date(p.created_at), "dd MMM, yyyy", { locale: ptBR })}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/blog/${p.slug}/editar`} className="h-7 w-7 rounded-lg bg-[var(--rv-surface-2)] border border-[var(--rv-border)] flex items-center justify-center text-[10px] hover:border-[var(--rv-accent)] hover:text-white text-[var(--rv-text-dim)] transition-all" title="Editar">✏</Link>

                          {(p.status === "draft" || p.status === "pending") && (
                            <button onClick={() => publishMutation.mutate(p.slug)} disabled={publishMutation.isPending} className="h-7 px-2 rounded-lg bg-[var(--rv-accent)]/10 border border-[var(--rv-accent)]/30 text-[var(--rv-accent)] text-[9px] rv-label hover:bg-[var(--rv-accent)]/20 transition-all disabled:opacity-40">
                              Publicar
                            </button>
                          )}

                          {p.status === "published" && (
                            <button onClick={() => archiveMutation.mutate(p.slug)} disabled={archiveMutation.isPending} className="h-7 px-2 rounded-lg bg-[var(--rv-surface-2)] border border-[var(--rv-border)] text-[var(--rv-text-dim)] text-[9px] rv-label hover:border-orange-500/40 hover:text-orange-400 transition-all disabled:opacity-40">
                              Arquivar
                            </button>
                          )}

                          <button
                            onClick={() => { if (confirmDeleteSlug !== p.slug) { setConfirmDeleteSlug(p.slug); return; } deleteMutation.mutate(p.slug); }}
                            disabled={deleteMutation.isPending}
                            className="h-7 w-7 rounded-lg bg-red-500/5 border border-red-500/20 flex items-center justify-center text-red-500/50 hover:text-red-500 hover:bg-red-500/10 transition-all text-[10px] disabled:opacity-40"
                          >
                            {confirmDeleteSlug === p.slug ? "!" : "✕"}
                          </button>
                          {confirmDeleteSlug === p.slug && (
                            <button onClick={() => setConfirmDeleteSlug(null)} disabled={deleteMutation.isPending} className="h-7 px-2 rounded-lg bg-[var(--rv-surface-2)] border border-[var(--rv-border)] text-[var(--rv-text-dim)] text-[9px] rv-label hover:bg-white/5 transition-all disabled:opacity-40">
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data && data.count > 15 && (
              <div className="px-5 py-3 bg-white/[0.02] border-t border-[var(--rv-border)] flex items-center justify-between">
                <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">{data.count} POSTS NO TOTAL</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-7 px-3 rounded-lg border border-[var(--rv-border)] text-[var(--rv-text-dim)] text-[9px] rv-label hover:bg-white/5 transition-all disabled:opacity-30">←</button>
                  <span className="h-7 px-3 flex items-center rv-label text-[9px] text-[var(--rv-text-dim)]">{page} / {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="h-7 px-3 rounded-lg border border-[var(--rv-border)] text-[var(--rv-text-dim)] text-[9px] rv-label hover:bg-white/5 transition-all disabled:opacity-30">→</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
