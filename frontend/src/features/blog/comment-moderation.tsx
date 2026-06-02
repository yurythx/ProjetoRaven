"use client";

import * as React from "react";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Search, Trash2, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

import { ConfirmDialog } from "@/components/rv-confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type PostLite = { id: string; title: string; slug: string };

type ModerationItem = {
  id: string;
  content: string;
  created_at: string;
  parent?: string | null;
  is_public: boolean;
  is_approved: boolean;
  author_name?: string | null;
  name?: string | null;
  email?: string | null;
  reply_count?: number;
  article_slug?: string | null;
};

type RepliesState = Record<
  string,
  { isOpen: boolean; items: ModerationItem[]; next: string | null; isLoading: boolean }
>;

async function adminGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api/blog-admin/${path}`, { signal });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json() as Promise<T>;
}

async function adminPost(path: string, body?: unknown): Promise<void> {
  const res = await fetch(`/api/blog-admin/${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(data.detail ?? `Erro ${res.status}`);
  }
}

async function adminDelete(path: string): Promise<void> {
  const res = await fetch(`/api/blog-admin/${path}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(data.detail ?? `Erro ${res.status}`);
  }
}

const parsePageParam = (nextUrl: string | null) => {
  if (!nextUrl) return undefined;
  try {
    const url = new URL(nextUrl, "http://localhost");
    const p = url.searchParams.get("page");
    const n = p ? Number(p) : NaN;
    return Number.isFinite(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
};

export function BlogCommentModeration() {
  const queryClient = useQueryClient();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<"pending" | "approved" | "all">("pending");
  const [postId, setPostId] = React.useState<string>("");
  const [fromDate, setFromDate] = React.useState<string>("");
  const [toDate, setToDate] = React.useState<string>("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [threadToDelete, setThreadToDelete] = React.useState<ModerationItem | null>(null);
  const [repliesByParent, setRepliesByParent] = React.useState<RepliesState>({});

  const debounced = React.useMemo(() => query.trim(), [query]);

  const postsQuery = useQuery({
    queryKey: ["blog-posts-lite"],
    queryFn: async ({ signal }) => {
      const qs = new URLSearchParams({ ordering: "title", page_size: "200" });
      const data = await adminGet<Paginated<PostLite>>(`posts/?${qs}`, signal);
      return data.results;
    },
  });

  const createdAtGte = React.useMemo(() => {
    if (!fromDate) return null;
    const d = new Date(`${fromDate}T00:00:00.000Z`);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }, [fromDate]);

  const createdAtLte = React.useMemo(() => {
    if (!toDate) return null;
    const d = new Date(`${toDate}T23:59:59.999Z`);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }, [toDate]);

  const commentsQuery = useInfiniteQuery<Paginated<ModerationItem>>({
    queryKey: ["blog-comments-moderation", status, debounced, postId, createdAtGte, createdAtLte],
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      const safePage = typeof pageParam === "number" ? pageParam : Number(pageParam);
      const params: Record<string, string> = {
        ordering: "-created_at",
        page: String(Number.isFinite(safePage) && safePage > 0 ? safePage : 1),
        page_size: "20",
        is_public: "true",
        parent__isnull: "true",
      };
      if (status === "pending") params.is_approved = "false";
      if (status === "approved") params.is_approved = "true";
      if (debounced) params.search = debounced;
      if (postId) params.article = postId;
      if (createdAtGte) params.created_at__gte = createdAtGte;
      if (createdAtLte) params.created_at__lte = createdAtLte;
      const qs = new URLSearchParams(params);
      return adminGet<Paginated<ModerationItem>>(`comments/?${qs}`, signal);
    },
    getNextPageParam: (lastPage) => parsePageParam(lastPage.next),
  });

  const comments = React.useMemo(() => {
    const pages = commentsQuery.data?.pages ?? [];
    return pages.flatMap((p) => p.results);
  }, [commentsQuery.data]);

  React.useEffect(() => {
    setSelectedIds(new Set());
    setRepliesByParent({});
  }, [status, debounced, postId, createdAtGte, createdAtLte]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllLoaded = () => setSelectedIds(new Set(comments.map((c) => c.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const selectedCount = selectedIds.size;

  const invalidateComments = async () => {
    await queryClient.invalidateQueries({ queryKey: ["blog-comments-moderation"] });
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminPost(`comments/${encodeURIComponent(id)}/approve/`),
    onSuccess: async () => { await invalidateComments(); toast.success("Comentário aprovado"); },
    onError: () => toast.error("Falha ao aprovar"),
  });

  const disapproveMutation = useMutation({
    mutationFn: (id: string) => adminPost(`comments/${encodeURIComponent(id)}/disapprove/`),
    onSuccess: async () => { await invalidateComments(); toast.success("Comentário desaprovado"); },
    onError: () => toast.error("Falha ao desaprovar"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDelete(`comments/${encodeURIComponent(id)}/`),
    onSuccess: async () => { await invalidateComments(); toast.success("Comentário removido"); },
    onError: () => toast.error("Falha ao remover"),
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) => adminPost("comments/bulk_approve/", { ids }),
    onSuccess: async () => { await invalidateComments(); clearSelection(); toast.success("Comentários aprovados"); },
    onError: () => toast.error("Falha ao aprovar em lote"),
  });

  const bulkDisapproveMutation = useMutation({
    mutationFn: (ids: string[]) => adminPost("comments/bulk_disapprove/", { ids }),
    onSuccess: async () => { await invalidateComments(); clearSelection(); toast.success("Comentários reprovados"); },
    onError: () => toast.error("Falha ao reprovar em lote"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => adminPost("comments/bulk_delete/", { ids }),
    onSuccess: async () => { await invalidateComments(); clearSelection(); toast.success("Comentários removidos"); },
    onError: () => toast.error("Falha ao remover em lote"),
  });

  const approveThreadMutation = useMutation({
    mutationFn: (id: string) => adminPost(`comments/${encodeURIComponent(id)}/approve_thread/`),
    onSuccess: async () => { await invalidateComments(); toast.success("Thread aprovada"); },
    onError: () => toast.error("Falha ao aprovar thread"),
  });

  const disapproveThreadMutation = useMutation({
    mutationFn: (id: string) => adminPost(`comments/${encodeURIComponent(id)}/disapprove_thread/`),
    onSuccess: async () => { await invalidateComments(); toast.success("Thread reprovada"); },
    onError: () => toast.error("Falha ao reprovar thread"),
  });

  const deleteThreadMutation = useMutation({
    mutationFn: (id: string) => adminPost(`comments/${encodeURIComponent(id)}/delete_thread/`),
    onSuccess: async () => { await invalidateComments(); toast.success("Thread removida"); },
    onError: () => toast.error("Falha ao remover thread"),
  });

  const toggleReplies = (parentId: string) => {
    setRepliesByParent((prev) => {
      const existing = prev[parentId];
      return {
        ...prev,
        [parentId]: {
          isOpen: !(existing?.isOpen ?? false),
          items: existing?.items ?? [],
          next: existing?.next ?? null,
          isLoading: existing?.isLoading ?? false,
        },
      };
    });
  };

  const loadMoreReplies = async (parentId: string) => {
    const cur = repliesByParent[parentId];
    const pageParam = parsePageParam(cur?.next ?? null) ?? 1;
    setRepliesByParent((prev) => ({
      ...prev,
      [parentId]: { isOpen: true, items: prev[parentId]?.items ?? [], next: prev[parentId]?.next ?? null, isLoading: true },
    }));
    try {
      const qs = new URLSearchParams({ page: String(pageParam), page_size: "20" });
      const data = await adminGet<Paginated<ModerationItem>>(
        `comments/${encodeURIComponent(parentId)}/replies/?${qs}`
      );
      setRepliesByParent((prev) => {
        const existing = prev[parentId]?.items ?? [];
        const seen = new Set(existing.map((x) => x.id));
        const merged = [...existing, ...data.results.filter((x) => !seen.has(x.id))];
        return { ...prev, [parentId]: { isOpen: true, items: merged, next: data.next, isLoading: false } };
      });
    } catch {
      setRepliesByParent((prev) => ({
        ...prev,
        [parentId]: { isOpen: true, items: prev[parentId]?.items ?? [], next: prev[parentId]?.next ?? null, isLoading: false },
      }));
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Moderação de comentários (Blog)</h1>
        <Link href="/blog" className="text-sm font-medium text-foreground hover:underline">
          Ir para o blog
        </Link>
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl border border-foreground/10 bg-background p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2">
            <Search className="h-4 w-4 text-foreground/60" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por conteúdo, nome, email..." />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "pending" | "approved" | "all")}
            className="h-10 rounded-xl border border-foreground/15 bg-background px-3 text-sm text-foreground"
          >
            <option value="pending">Pendentes</option>
            <option value="approved">Aprovados</option>
            <option value="all">Todos</option>
          </select>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm">
            <span className="text-foreground/70">Post</span>
            <select
              value={postId}
              onChange={(e) => setPostId(e.target.value)}
              className="h-10 rounded-xl border border-foreground/15 bg-background px-3 text-sm text-foreground"
            >
              <option value="">Todos</option>
              {(postsQuery.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-foreground/70">De</span>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-foreground/70">Até</span>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-background p-4">
        <div className="text-sm text-foreground/70">
          {selectedCount > 0 ? `${selectedCount} selecionado(s)` : "Nenhum selecionado"}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={selectAllLoaded} disabled={comments.length === 0}>
            Selecionar carregados
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={clearSelection} disabled={selectedCount === 0}>
            Limpar
          </Button>
          <Button
            type="button" variant="secondary" size="sm"
            disabled={selectedCount === 0 || bulkApproveMutation.isPending}
            onClick={() => bulkApproveMutation.mutate(Array.from(selectedIds))}
          >
            <Check className="mr-2 h-4 w-4" /> Aprovar
          </Button>
          <Button
            type="button" variant="secondary" size="sm"
            disabled={selectedCount === 0 || bulkDisapproveMutation.isPending}
            onClick={() => bulkDisapproveMutation.mutate(Array.from(selectedIds))}
          >
            <X className="mr-2 h-4 w-4" /> Reprovar
          </Button>
          <Button type="button" variant="destructive" size="sm" disabled={selectedCount === 0} onClick={() => setBulkDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Excluir
          </Button>
        </div>
      </div>

      <ScrollArea className="mt-6 h-[70vh] rounded-2xl border border-foreground/10 bg-background">
        <div className="grid gap-3 p-4">
          {commentsQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-foreground/70">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          )}

          {!commentsQuery.isLoading && comments.length === 0 && (
            <div className="text-sm text-foreground/70">Nenhum comentário encontrado.</div>
          )}

          {comments.map((c) => {
            const title = c.author_name || c.name || "Anônimo";
            const created = new Date(c.created_at).toLocaleString("pt-BR");
            const postSlug = c.article_slug ?? null;
            const postUrl = postSlug ? `/blog/${encodeURIComponent(postSlug)}` : null;
            const isSelected = selectedIds.has(c.id);
            const repliesState = repliesByParent[c.id] ?? null;
            const repliesOpen = Boolean(repliesState?.isOpen);
            const repliesCount = Number(c.reply_count ?? 0);

            return (
              <div key={c.id} className="rounded-2xl border border-foreground/10 bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <div className="text-sm font-medium text-foreground">{title}</div>
                    <div className="text-xs text-foreground/60">
                      {created}
                      {c.email ? ` · ${c.email}` : ""}
                      {postUrl && (
                        <> · <Link href={postUrl} className="font-medium text-foreground hover:underline">ver post</Link></>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelected(c.id)} aria-label="Selecionar comentário" />
                    {c.is_approved ? <Badge variant="secondary">aprovado</Badge> : <Badge variant="outline">pendente</Badge>}
                    <Button size="sm" variant="secondary" onClick={() => approveMutation.mutate(c.id)} disabled={approveMutation.isPending}>
                      <Check className="mr-2 h-4 w-4" /> Aprovar
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => disapproveMutation.mutate(c.id)} disabled={disapproveMutation.isPending}>
                      <X className="mr-2 h-4 w-4" /> Reprovar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(c.id)} disabled={deleteMutation.isPending}>
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                    </Button>
                  </div>
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm text-foreground/80">{c.content}</div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {repliesCount > 0 ? (
                    <>
                      <Button type="button" variant="secondary" size="sm" onClick={() => toggleReplies(c.id)}>
                        {repliesOpen ? "Ocultar replies" : `Ver replies (${repliesCount})`}
                      </Button>
                      {repliesOpen && (
                        <Button type="button" variant="secondary" size="sm" onClick={() => void loadMoreReplies(c.id)} disabled={Boolean(repliesState?.isLoading)}>
                          {repliesState?.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Carregar replies
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-foreground/60">Sem replies</div>
                  )}

                  <Button type="button" variant="secondary" size="sm" onClick={() => approveThreadMutation.mutate(c.id)} disabled={approveThreadMutation.isPending}>
                    <Check className="mr-2 h-4 w-4" /> Aprovar thread
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => disapproveThreadMutation.mutate(c.id)} disabled={disapproveThreadMutation.isPending}>
                    <X className="mr-2 h-4 w-4" /> Reprovar thread
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => setThreadToDelete(c)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Excluir thread
                  </Button>
                </div>

                {repliesOpen && (
                  <div className="mt-3 grid gap-2 rounded-xl border border-foreground/10 bg-background p-3">
                    {(repliesState?.items ?? []).map((r) => (
                      <div key={r.id} className="rounded-xl border border-foreground/10 bg-background p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-medium text-foreground/70">{r.author_name || r.name || "Anônimo"}</div>
                          <div className="text-xs text-foreground/60" suppressHydrationWarning>{new Date(r.created_at).toLocaleString("pt-BR")}</div>
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">{r.content}</div>
                      </div>
                    ))}
                    {repliesState?.next && (
                      <Button type="button" variant="secondary" size="sm" onClick={() => void loadMoreReplies(c.id)} disabled={Boolean(repliesState?.isLoading)} className="self-start">
                        {repliesState?.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Carregar mais replies
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {commentsQuery.hasNextPage && (
            <div className="pt-2">
              <Button variant="secondary" onClick={() => commentsQuery.fetchNextPage()} disabled={commentsQuery.isFetchingNextPage}>
                {commentsQuery.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Carregar mais
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title="Excluir comentários selecionados?"
        description={`Esta ação remove ${selectedCount} comentário(s). Não é possível desfazer.`}
        confirmLabel="Excluir"
        variant="danger"
        isPending={bulkDeleteMutation.isPending}
        onConfirm={() => { setBulkDeleteOpen(false); bulkDeleteMutation.mutate(Array.from(selectedIds)); }}
      />

      <ConfirmDialog
        open={Boolean(threadToDelete)}
        onClose={() => setThreadToDelete(null)}
        title="Excluir thread?"
        description="Remove o comentário e todas as replies associadas."
        confirmLabel="Excluir"
        variant="danger"
        isPending={deleteThreadMutation.isPending}
        onConfirm={() => { const id = threadToDelete?.id; setThreadToDelete(null); if (id) deleteThreadMutation.mutate(id); }}
      />
    </div>
  );
}
