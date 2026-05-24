"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { sanitizeRichTextHtml } from "@/lib/sanitize-html";
import { Search, ChevronDown, ChevronUp, ExternalLink, Pin, Lock, Archive, Eye, EyeOff, CheckCircle2 } from "lucide-react";

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type TopicListItem = {
  id: string;
  title: string;
  slug: string;
  category: string;
  category_name: string;
  status: string;
  reply_count: number;
  view_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  last_reply_at: string | null;
  created_at: string;
};

type ReplyAuthor = {
  id: string;
  username: string;
  display_name?: string | null;
};

type ReplyListItem = {
  id: string;
  content: string;
  author: ReplyAuthor | null;
  topic: string;
  is_solution: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  open: "Aberto",
  archived: "Arquivado",
  closed: "Fechado",
};
const STATUS_BADGE: Record<string, string> = {
  open: "rv-badge-cyan",
  archived: "rv-badge-red",
  closed: "rv-badge-gold",
};

function formatDate(v: string | null): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR");
}

type HidePending = { id: string; reason: string };

export function ForumModerationPanel() {
  const [query, setQuery] = React.useState("");
  const debounced = useDebounce(query, 300);
  const queryClient = useQueryClient();

  const [expandedSlug, setExpandedSlug] = React.useState<string | null>(null);
  const [confirmArchiveSlug, setConfirmArchiveSlug] = React.useState<string | null>(null);
  const [hidePending, setHidePending] = React.useState<HidePending | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["forum-moderation-topics", debounced],
    queryFn: async ({ signal }) => {
      const qs = new URLSearchParams({ page: "1", page_size: "50", ordering: "-created_at" });
      if (debounced.trim()) qs.set("q", debounced.trim());
      const res = await fetch(`/api/forum/topics/?${qs.toString()}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<Paginated<TopicListItem>>;
    },
  });

  const topicMutation = useMutation({
    mutationFn: async ({ slug, action }: { slug: string; action: string }) => {
      const res = await fetch(`/api/forum/topics/${encodeURIComponent(slug)}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: async () => {
      setConfirmArchiveSlug(null);
      await queryClient.invalidateQueries({ queryKey: ["forum-moderation-topics"] });
      await queryClient.invalidateQueries({ queryKey: ["forum:topics"] });
    },
  });

  const { data: repliesData, isLoading: isRepliesLoading } = useQuery({
    queryKey: ["forum-moderation-replies", expandedSlug],
    enabled: Boolean(expandedSlug),
    queryFn: async ({ signal }) => {
      const qs = new URLSearchParams({ page: "1", page_size: "200", include_hidden: "1" });
      if (expandedSlug) qs.set("topic", expandedSlug);
      const res = await fetch(`/api/forum/replies/?${qs.toString()}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<Paginated<ReplyListItem>>;
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: string; reason?: string }) => {
      const res = await fetch(`/api/forum/replies/${encodeURIComponent(id)}/${action}`, {
        method: "POST",
        ...(action === "hide"
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason ?? "" }) }
          : {}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: async () => {
      setHidePending(null);
      await queryClient.invalidateQueries({ queryKey: ["forum-moderation-replies"] });
      await queryClient.invalidateQueries({ queryKey: ["forum-moderation-topics"] });
      await queryClient.invalidateQueries({ queryKey: ["forum:topics"] });
    },
  });

  const topics = data?.results ?? [];
  const replies = repliesData?.results ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="rv-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--rv-text-dim)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar tópicos..."
            className="rv-input h-9 pl-9 text-xs w-full"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">
            {isLoading ? "Carregando..." : `${topics.length} tópicos`}
          </span>
          <Link href="/forum" className="rv-btn rv-btn-ghost h-9 px-4 text-xs gap-1.5 flex items-center">
            <ExternalLink className="h-3 w-3" /> Fórum
          </Link>
        </div>
      </div>

      {/* Topics table */}
      <div className="rv-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-[var(--rv-border)]">
                {["TÓPICO", "CATEGORIA", "STATUS", "MÉTRICAS", "AÇÕES"].map((h) => (
                  <th key={h} className="px-5 py-3 rv-label text-[9px] text-[var(--rv-text-dim)] tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rv-border)]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <div className="h-5 w-5 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
                      <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">CARREGANDO...</span>
                    </div>
                  </td>
                </tr>
              ) : topics.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-xs text-[var(--rv-text-muted)]">
                    Nenhum tópico encontrado.
                  </td>
                </tr>
              ) : topics.map((t) => {
                const status = (t.status || "open").toLowerCase();
                const isExpanded = expandedSlug === t.slug;
                const isArchived = status === "archived";
                const isArchiveConfirm = confirmArchiveSlug === t.slug;

                return (
                  <React.Fragment key={t.id}>
                    <tr className="hover:bg-white/[0.015] transition-colors">
                      {/* Tópico */}
                      <td className="px-5 py-4 max-w-[280px]">
                        <Link href={`/forum/t/${encodeURIComponent(t.slug)}`} className="text-[var(--rv-text-primary)] text-xs font-medium hover:text-[var(--rv-accent)] transition-colors line-clamp-2">
                          {t.title}
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                          {t.is_pinned && (
                            <span className="rv-badge rv-badge-gold text-[8px]"><Pin className="h-2 w-2 inline mr-0.5" />Fixado</span>
                          )}
                          {t.is_locked && (
                            <span className="rv-badge rv-badge-red text-[8px]"><Lock className="h-2 w-2 inline mr-0.5" />Fechado</span>
                          )}
                          <span className="text-[9px] text-[var(--rv-text-dim)]">{formatDate(t.created_at)}</span>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="px-5 py-4">
                        <Link href={`/forum/c/${encodeURIComponent(t.category)}`} className="rv-label text-[9px] px-2 py-0.5 rounded-md bg-[var(--rv-surface-2)] border border-[var(--rv-border)] text-[var(--rv-text-muted)] hover:text-white transition-colors">
                          {t.category_name}
                        </Link>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span className={`rv-badge text-[9px] ${STATUS_BADGE[status] ?? "rv-badge-purple"}`}>
                          {STATUS_LABEL[status] ?? status}
                        </span>
                      </td>

                      {/* Métricas */}
                      <td className="px-5 py-4 text-[10px] text-[var(--rv-text-dim)]">
                        <div>{t.reply_count} replies</div>
                        <div>{t.view_count} views</div>
                      </td>

                      {/* Ações */}
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Expand replies */}
                          <button
                            onClick={() => setExpandedSlug((cur) => (cur === t.slug ? null : t.slug))}
                            className={`h-7 px-2 rounded-lg border text-[9px] rv-label flex items-center gap-1 transition-all ${
                              isExpanded
                                ? "bg-[var(--rv-accent)]/20 border-[var(--rv-accent)]/40 text-[var(--rv-accent)]"
                                : "bg-[var(--rv-surface-2)] border-[var(--rv-border)] text-[var(--rv-text-dim)] hover:border-[var(--rv-accent)]/30"
                            }`}
                          >
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            Replies
                          </button>

                          {/* Pin / Unpin */}
                          <button
                            onClick={() => topicMutation.mutate({ slug: t.slug, action: t.is_pinned ? "unpin" : "pin" })}
                            disabled={topicMutation.isPending}
                            title={t.is_pinned ? "Desfixar" : "Fixar"}
                            className="h-7 w-7 rounded-lg bg-[var(--rv-surface-2)] border border-[var(--rv-border)] flex items-center justify-center text-[var(--rv-text-dim)] hover:text-[var(--rv-gold)] hover:border-[var(--rv-gold)]/30 transition-all disabled:opacity-40"
                          >
                            <Pin className="h-3.5 w-3.5" />
                          </button>

                          {/* Lock / Unlock */}
                          <button
                            onClick={() => topicMutation.mutate({ slug: t.slug, action: t.is_locked ? "open" : "close" })}
                            disabled={topicMutation.isPending}
                            title={t.is_locked ? "Abrir" : "Fechar"}
                            className="h-7 w-7 rounded-lg bg-[var(--rv-surface-2)] border border-[var(--rv-border)] flex items-center justify-center text-[var(--rv-text-dim)] hover:text-orange-400 hover:border-orange-400/30 transition-all disabled:opacity-40"
                          >
                            <Lock className="h-3.5 w-3.5" />
                          </button>

                          {/* Archive — double-confirm */}
                          {!isArchived && (
                            <>
                              <button
                                onClick={() => {
                                  if (!isArchiveConfirm) { setConfirmArchiveSlug(t.slug); return; }
                                  topicMutation.mutate({ slug: t.slug, action: "archive" });
                                }}
                                disabled={topicMutation.isPending}
                                title="Arquivar"
                                className={`h-7 w-7 rounded-lg border flex items-center justify-center text-[10px] transition-all disabled:opacity-40 ${
                                  isArchiveConfirm
                                    ? "bg-red-500/10 border-red-500/40 text-red-400"
                                    : "bg-[var(--rv-surface-2)] border-[var(--rv-border)] text-[var(--rv-text-dim)] hover:text-red-400 hover:border-red-400/30"
                                }`}
                              >
                                {isArchiveConfirm ? "!" : <Archive className="h-3.5 w-3.5" />}
                              </button>
                              {isArchiveConfirm && (
                                <button
                                  onClick={() => setConfirmArchiveSlug(null)}
                                  className="h-7 px-2 rounded-lg bg-[var(--rv-surface-2)] border border-[var(--rv-border)] text-[var(--rv-text-dim)] text-[9px] rv-label hover:bg-white/5 transition-all"
                                >
                                  Cancelar
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Inline replies panel */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="px-5 py-4 bg-[var(--rv-surface-2)]/30 border-b border-[var(--rv-border)]">
                          <div className="rounded-xl border border-[var(--rv-border)] overflow-hidden">
                            <div className="px-4 py-2 bg-white/[0.03] border-b border-[var(--rv-border)] flex items-center justify-between">
                              <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">
                                REPLIES — {isRepliesLoading ? "Carregando..." : `${replies.length} itens`}
                              </span>
                            </div>
                            {isRepliesLoading ? (
                              <div className="p-6 text-center text-xs text-[var(--rv-text-muted)]">Carregando...</div>
                            ) : replies.length === 0 ? (
                              <div className="p-6 text-center text-xs text-[var(--rv-text-muted)]">Nenhuma reply.</div>
                            ) : (
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-white/[0.02]">
                                    {["AUTOR", "CONTEÚDO", "STATUS", "AÇÕES"].map((h) => (
                                      <th key={h} className="px-4 py-2 rv-label text-[8px] text-[var(--rv-text-dim)] tracking-widest">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--rv-border)]">
                                  {replies.map((r) => {
                                    const authorLabel = r.author?.display_name || r.author?.username || "—";
                                    const isHidePending = hidePending?.id === r.id;
                                    return (
                                      <tr key={r.id} className={`hover:bg-white/[0.01] transition-colors ${r.is_hidden ? "opacity-50" : ""}`}>
                                        <td className="px-4 py-3 text-xs text-[var(--rv-text-muted)] whitespace-nowrap">{authorLabel}</td>
                                        <td className="px-4 py-3 max-w-[420px]">
                                          <div
                                            className="text-xs text-[var(--rv-text-muted)] line-clamp-2"
                                            dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(r.content) }}
                                          />
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <div className="flex items-center gap-1.5">
                                            {r.is_solution && <span className="rv-badge rv-badge-cyan text-[8px]"><CheckCircle2 className="h-2 w-2 inline mr-0.5" />Solução</span>}
                                            {r.is_hidden && <span className="rv-badge rv-badge-red text-[8px]"><EyeOff className="h-2 w-2 inline mr-0.5" />Oculta</span>}
                                            {!r.is_solution && !r.is_hidden && <span className="text-[9px] text-[var(--rv-text-dim)]">Normal</span>}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="flex flex-col gap-2">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              {/* Hide / Unhide */}
                                              {r.is_hidden ? (
                                                <button
                                                  onClick={() => replyMutation.mutate({ id: r.id, action: "unhide" })}
                                                  disabled={replyMutation.isPending}
                                                  className="h-7 px-2 rounded-lg bg-[var(--rv-surface-2)] border border-[var(--rv-border)] text-[var(--rv-text-dim)] text-[9px] rv-label hover:border-[var(--rv-accent)]/30 hover:text-[var(--rv-accent)] transition-all disabled:opacity-40 flex items-center gap-1"
                                                >
                                                  <Eye className="h-3 w-3" /> Reexibir
                                                </button>
                                              ) : (
                                                <button
                                                  onClick={() => setHidePending(isHidePending ? null : { id: r.id, reason: "" })}
                                                  className={`h-7 px-2 rounded-lg border text-[9px] rv-label flex items-center gap-1 transition-all ${
                                                    isHidePending
                                                      ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                                                      : "bg-[var(--rv-surface-2)] border-[var(--rv-border)] text-[var(--rv-text-dim)] hover:border-orange-400/30 hover:text-orange-400"
                                                  }`}
                                                >
                                                  <EyeOff className="h-3 w-3" /> Ocultar
                                                </button>
                                              )}

                                              {/* Solution */}
                                              <button
                                                onClick={() => replyMutation.mutate({ id: r.id, action: r.is_solution ? "unmark-solution" : "mark-solution" })}
                                                disabled={replyMutation.isPending}
                                                className="h-7 px-2 rounded-lg bg-[var(--rv-surface-2)] border border-[var(--rv-border)] text-[var(--rv-text-dim)] text-[9px] rv-label hover:border-[var(--rv-cyan)]/30 hover:text-[var(--rv-cyan)] transition-all disabled:opacity-40 flex items-center gap-1"
                                              >
                                                <CheckCircle2 className="h-3 w-3" />
                                                {r.is_solution ? "Desmarcar" : "Solução"}
                                              </button>
                                            </div>

                                            {/* Inline reason input for hide */}
                                            {isHidePending && (
                                              <div className="flex items-center gap-1.5">
                                                <input
                                                  autoFocus
                                                  value={hidePending?.reason ?? ""}
                                                  onChange={(e) => setHidePending({ id: r.id, reason: e.target.value })}
                                                  placeholder="Motivo (opcional)"
                                                  className="rv-input h-7 text-[10px] flex-1 min-w-0"
                                                  onKeyDown={(e) => {
                                                    if (e.key === "Enter") replyMutation.mutate({ id: r.id, action: "hide", reason: hidePending?.reason });
                                                    if (e.key === "Escape") setHidePending(null);
                                                  }}
                                                />
                                                <button
                                                  onClick={() => replyMutation.mutate({ id: r.id, action: "hide", reason: hidePending?.reason })}
                                                  disabled={replyMutation.isPending}
                                                  className="h-7 px-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[9px] rv-label hover:bg-red-500/20 transition-all disabled:opacity-40"
                                                >
                                                  Confirmar
                                                </button>
                                                <button
                                                  onClick={() => setHidePending(null)}
                                                  className="h-7 px-2 rounded-lg bg-[var(--rv-surface-2)] border border-[var(--rv-border)] text-[var(--rv-text-dim)] text-[9px] rv-label transition-all"
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
