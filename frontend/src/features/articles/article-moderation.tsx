"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ConfirmDialog } from "@/components/rv-confirm-dialog"
import { Check, Loader2, Pencil, Search, X } from "lucide-react"
import { toast } from "@/hooks/use-toast"

type ArticleLite = {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  created_at?: string | null
  updated_at?: string | null
  category_name?: string | null
  author_name?: string | null
  is_public?: boolean
  status?: string
}

type Category = { id: string; name: string }

type Paginated<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

const parsePageParam = (nextUrl: string | null) => {
  if (!nextUrl) return undefined
  try {
    const url = new URL(nextUrl, "http://localhost")
    const p = url.searchParams.get("page")
    const n = p ? Number(p) : NaN
    return Number.isFinite(n) && n > 0 ? n : undefined
  } catch {
    return undefined
  }
}

export function ArticleModeration() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const u = (user ?? null) as Record<string, unknown> | null
  const canModerate = Boolean(u?.is_admin || u?.is_blog_editor || u?.is_staff || u?.is_superuser)

  const [query, setQuery] = React.useState("")
  const debounced = React.useMemo(() => query.trim(), [query])
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [rejectReason, setRejectReason] = React.useState("")
  const [rejectTargets, setRejectTargets] = React.useState<ArticleLite[]>([])
  const [status, setStatus] = React.useState<"pending" | "published" | "rejected" | "all">("pending")
  const [categoryId, setCategoryId] = React.useState<string>("all")
  const [ordering, setOrdering] = React.useState<string>("-updated_at")
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const selectedCount = selectedIds.size
  const didInitFromUrl = React.useRef(false)
  const urlSyncDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const statusMeta = React.useMemo(() => ({
    pending: { label: "Pendente", badge: "bg-amber-500/20 text-amber-500" },
    published: { label: "Publicado", badge: "bg-emerald-500/20 text-emerald-400" },
    rejected: { label: "Rejeitado", badge: "bg-rose-500/20 text-rose-500" },
    draft: { label: "Rascunho", badge: "bg-violet-500/20 text-violet-300" },
    scheduled: { label: "Agendado", badge: "bg-sky-500/20 text-sky-300" },
    archived: { label: "Arquivado", badge: "bg-zinc-500/20 text-zinc-300" },
  }) satisfies Record<string, { label: string; badge: string }>, [])

  const countsQuery = useQuery({
    queryKey: ["articles-moderation-counts", categoryId, debounced],
    queryFn: async ({ signal }) => {
      const fetchCount = async (s?: "pending" | "published" | "rejected") => {
        const params: Record<string, string> = { page_size: "1" }
        if (s) params.status = s
        if (categoryId !== "all") params.category = categoryId
        if (debounced) params.search = debounced
        const qs = new URLSearchParams(params).toString()
        const res = await fetch(`/api/blog-admin/articles/?${qs}`, { signal })
        if (!res.ok) throw new Error(`Erro ${res.status}`)
        const data = await res.json() as { count?: unknown }
        return Number.isFinite(Number(data?.count)) ? Number(data.count) : 0
      }

      const [pending, published, rejected, all] = await Promise.all([
        fetchCount("pending"),
        fetchCount("published"),
        fetchCount("rejected"),
        fetchCount(undefined),
      ])
      return { pending, published, rejected, all }
    },
    enabled: canModerate,
    staleTime: 20_000,
    retry: 1,
  })

  React.useEffect(() => {
    if (didInitFromUrl.current) return

    const s = (searchParams.get("status") || "").trim().toLowerCase()
    const q = searchParams.get("q") ?? ""
    const cat = searchParams.get("category") ?? ""
    const ord = (searchParams.get("ordering") || "").trim()

    const allowedStatus = new Set(["pending", "published", "rejected", "all"])
    if (allowedStatus.has(s)) setStatus(s as "pending" | "published" | "rejected" | "all")
    if (q) setQuery(q)
    if (cat) setCategoryId(cat)
    if (ord) setOrdering(ord)

    didInitFromUrl.current = true
  }, [searchParams])

  React.useEffect(() => {
    if (!didInitFromUrl.current) return
    if (urlSyncDebounceRef.current) clearTimeout(urlSyncDebounceRef.current)

    urlSyncDebounceRef.current = setTimeout(() => {
      const qs = new URLSearchParams()
      if (status !== "pending") qs.set("status", status)
      if (categoryId !== "all") qs.set("category", categoryId)
      if (ordering !== "-updated_at") qs.set("ordering", ordering)
      if (debounced) qs.set("q", debounced)
      const href = qs.toString() ? `${pathname}?${qs.toString()}` : pathname
      router.replace(href, { scroll: false })
    }, 250)

    return () => {
      if (urlSyncDebounceRef.current) clearTimeout(urlSyncDebounceRef.current)
    }
  }, [router, pathname, status, categoryId, ordering, debounced])

  const categoriesQuery = useQuery({
    queryKey: ["articles-categories-lite"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/blog-admin/categories/", { signal })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const data = await res.json() as Category[] | { results: Category[] }
      const list = Array.isArray(data) ? data : (data.results || [])
      return Array.isArray(list) ? list : []
    },
    enabled: canModerate,
    staleTime: 10 * 60_000,
    retry: 1,
  })
  const categories = categoriesQuery.data ?? []

  const pendingQuery = useInfiniteQuery<Paginated<ArticleLite>>({
    queryKey: ["articles-moderation", status, categoryId, debounced, ordering],
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      const safePage = typeof pageParam === "number" ? pageParam : Number(pageParam)
      const params: Record<string, string | number> = {
        ordering,
        page: Number.isFinite(safePage) && safePage > 0 ? safePage : 1,
        page_size: 18,
      }
      if (status !== "all") params.status = status
      if (categoryId !== "all") params.category = categoryId
      if (debounced) params.search = debounced
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
      ).toString()
      const res = await fetch(`/api/blog-admin/articles/?${qs}`, { signal })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      return await res.json() as Paginated<ArticleLite>
    },
    getNextPageParam: (lastPage) => parsePageParam(lastPage.next),
    enabled: canModerate,
    retry: 1,
  })

  const items = React.useMemo(() => {
    const pages = pendingQuery.data?.pages ?? []
    return pages.flatMap((p) => p.results)
  }, [pendingQuery.data])

  React.useEffect(() => {
    setSelectedIds(new Set())
  }, [status, categoryId, debounced, ordering])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const ids = items.map((a) => a.id)
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id))
      if (allSelected) return new Set()
      return new Set(ids)
    })
  }

  const runInBatches = async <T,>(
    tasks: Array<() => Promise<T>>,
    concurrency: number
  ): Promise<Array<PromiseSettledResult<T>>> => {
    const results: Array<PromiseSettledResult<T>> = new Array(tasks.length)
    let cursor = 0

    const worker = async () => {
      while (cursor < tasks.length) {
        const idx = cursor
        cursor += 1
        try {
          const v = await tasks[idx]()
          results[idx] = { status: "fulfilled", value: v }
        } catch (e) {
          results[idx] = { status: "rejected", reason: e }
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()))
    return results
  }

  const approveMutation = useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch(`/api/blog-admin/articles/${encodeURIComponent(slug)}/publish/`, { method: 'POST' })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["articles-moderation"] })
      await queryClient.invalidateQueries({ queryKey: ["articles-moderation-counts"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard-articles-grid"] })
      toast.success("Post aprovado e publicado")
    },
    onError: () => {
      toast.error("Falha ao aprovar post")
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ slug, reason }: { slug: string; reason: string }) => {
      const res = await fetch(`/api/blog-admin/articles/${encodeURIComponent(slug)}/reject/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["articles-moderation"] })
      await queryClient.invalidateQueries({ queryKey: ["articles-moderation-counts"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard-articles-grid"] })
      toast.success("Post rejeitado")
    },
    onError: () => {
      toast.error("Falha ao rejeitar post")
    },
  })

  const bulkApproveMutation = useMutation({
    mutationFn: async (slugs: string[]) => {
      try {
        const res = await fetch("/api/blog-admin/articles/bulk/publish/", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slugs }),
        })
        if (!res.ok) throw new Error(`Erro ${res.status}`)
        const data = await res.json() as { approved?: string[]; failed?: unknown[] }
        const approved = Array.isArray(data?.approved) ? data.approved : []
        const failed = Array.isArray(data?.failed) ? data.failed : []
        const failedSlugs = failed
          .map((f) => (typeof f === "object" && f && "slug" in f ? (f as { slug?: unknown }).slug : null))
          .filter((s): s is string => typeof s === "string" && s.length > 0)
        return { ok: approved.length, fail: failed.length, failedSlugs }
      } catch {
        const tasks = slugs.map((slug) => () =>
          fetch(`/api/blog-admin/articles/${encodeURIComponent(slug)}/publish/`, { method: 'POST' })
            .then((r) => { if (!r.ok) throw new Error(`Erro ${r.status}`) })
        )
        const results = await runInBatches(tasks, 3)
        const ok = results.filter((r) => r.status === "fulfilled").length
        const fail = results.length - ok
        return { ok, fail, failedSlugs: [] as string[] }
      }
    },
    onSuccess: async ({ ok, fail, failedSlugs }) => {
      await queryClient.invalidateQueries({ queryKey: ["articles-moderation"] })
      await queryClient.invalidateQueries({ queryKey: ["articles-moderation-counts"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard-articles-grid"] })
      setSelectedIds(new Set())
      if (fail === 0) toast.success(`${ok} posts aprovados`)
      else {
        const sample = failedSlugs.slice(0, 3)
        const suffix = sample.length ? ` (${sample.join(", ")})` : ""
        toast.warning(`${ok} aprovados, ${fail} falharam${suffix}`)
      }
    },
    onError: () => {
      toast.error("Falha ao aprovar em lote")
    },
  })

  const bulkRejectMutation = useMutation({
    mutationFn: async ({ slugs, reason }: { slugs: string[]; reason: string }) => {
      try {
        const res = await fetch("/api/blog-admin/articles/bulk/reject/", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slugs, reason }),
        })
        if (!res.ok) throw new Error(`Erro ${res.status}`)
        const data = await res.json() as { rejected?: string[]; failed?: unknown[] }
        const rejected = Array.isArray(data?.rejected) ? data.rejected : []
        const failed = Array.isArray(data?.failed) ? data.failed : []
        const failedSlugs = failed
          .map((f) => (typeof f === "object" && f && "slug" in f ? (f as { slug?: unknown }).slug : null))
          .filter((s): s is string => typeof s === "string" && s.length > 0)
        return { ok: rejected.length, fail: failed.length, failedSlugs }
      } catch {
        const tasks = slugs.map((slug) => () =>
          fetch(`/api/blog-admin/articles/${encodeURIComponent(slug)}/reject/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
          }).then((r) => { if (!r.ok) throw new Error(`Erro ${r.status}`) })
        )
        const results = await runInBatches(tasks, 3)
        const ok = results.filter((r) => r.status === "fulfilled").length
        const fail = results.length - ok
        return { ok, fail, failedSlugs: [] as string[] }
      }
    },
    onSuccess: async ({ ok, fail, failedSlugs }) => {
      await queryClient.invalidateQueries({ queryKey: ["articles-moderation"] })
      await queryClient.invalidateQueries({ queryKey: ["articles-moderation-counts"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard-articles-grid"] })
      setSelectedIds(new Set())
      if (fail === 0) toast.success(`${ok} posts rejeitados`)
      else {
        const sample = failedSlugs.slice(0, 3)
        const suffix = sample.length ? ` (${sample.join(", ")})` : ""
        toast.warning(`${ok} rejeitados, ${fail} falharam${suffix}`)
      }
    },
    onError: () => {
      toast.error("Falha ao rejeitar em lote")
    },
  })

  const isMutating =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    bulkApproveMutation.isPending ||
    bulkRejectMutation.isPending

  const openReject = (articles: ArticleLite[]) => {
    setRejectTargets(articles)
    setRejectReason("")
    setRejectOpen(true)
  }

  const submitReject = () => {
    const reason = rejectReason.trim()
    if (rejectTargets.length === 0) return
    if (rejectTargets.length === 1) {
      rejectMutation.mutate({ slug: rejectTargets[0].slug, reason })
    } else {
      bulkRejectMutation.mutate({ slugs: rejectTargets.map((a) => a.slug), reason })
    }
    setRejectOpen(false)
    setRejectTargets([])
    setRejectReason("")
  }

  if (!canModerate) {
    return (
      <div className="text-center py-16 sm:py-20 border-2 border-dashed rounded-3xl bg-muted/10">
        <h3 className="text-lg font-semibold mb-2">Moderação de Posts</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Você não tem permissão para aprovar/rejeitar posts.
        </p>
      </div>
    )
  }

  return (
    <section className="space-y-8 animate-in fade-in duration-700" aria-label="Moderação de Posts">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/5 backdrop-blur-xl border border-white/10 p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-xl">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tighter">Moderação Editorial</h2>
          <p className="text-muted-foreground font-medium text-sm">
            Fluxo de aprovação ITIL para controle de qualidade de conteúdo.
          </p>
        </div>
        <div className="w-full md:w-auto flex flex-col md:flex-row gap-3">
          <div className="relative group w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar na fila..."
              className="pl-11 h-12 rounded-xl bg-white/5 border-white/10 hover:border-primary/30 transition-all shadow-inner"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { key: "pending", label: "Pendentes", cls: "bg-amber-500/15 text-amber-400 border-amber-500/20 hover:bg-amber-500/20" },
                { key: "published", label: "Publicados", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20" },
                { key: "rejected", label: "Rejeitados", cls: "bg-rose-500/15 text-rose-300 border-rose-500/20 hover:bg-rose-500/20" },
                { key: "all", label: "Todos", cls: "bg-white/5 text-foreground/80 border-white/10 hover:bg-white/10" },
              ] as const).map((t) => {
                const active = status === t.key
                const count = countsQuery.data?.[t.key] ?? null
                return (
                  <Button
                    key={t.key}
                    type="button"
                    variant="outline"
                    onClick={() => setStatus(t.key)}
                    className={cn(
                      "h-10 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest",
                      t.cls,
                      active ? "ring-2 ring-primary/30" : ""
                    )}
                    disabled={countsQuery.isFetching}
                  >
                    {t.label} {count !== null ? `(${count})` : ""}
                  </Button>
                )
              })}
            </div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-10 w-44 rounded-xl bg-white/5 border-white/10 hover:border-primary/30 shadow-inner">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl p-1">
                <SelectItem value="all" className="rounded-xl cursor-pointer">Todas</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="rounded-xl cursor-pointer">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ordering} onValueChange={setOrdering}>
              <SelectTrigger className="h-10 w-44 rounded-xl bg-white/5 border-white/10 hover:border-primary/30 shadow-inner">
                <SelectValue placeholder="Ordenação" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl p-1">
                <SelectItem value="-updated_at" className="rounded-xl cursor-pointer">Mais recentes (update)</SelectItem>
                <SelectItem value="-created_at" className="rounded-xl cursor-pointer">Mais recentes (criação)</SelectItem>
                <SelectItem value="-published_at" className="rounded-xl cursor-pointer">Publicação</SelectItem>
                <SelectItem value="-view_count" className="rounded-xl cursor-pointer">Mais vistos</SelectItem>
                <SelectItem value="title" className="rounded-xl cursor-pointer">Título (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {pendingQuery.isLoading && (
        <div className="flex items-center justify-center py-16" role="status" aria-live="polite">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
        </div>
      )}

      {pendingQuery.isError && (
        <div className="text-center py-12 border-2 border-destructive/20 rounded-3xl bg-destructive/5" role="alert" aria-live="assertive">
          <p className="text-destructive font-medium">Erro ao carregar fila de moderação.</p>
        </div>
      )}

      {!pendingQuery.isLoading && !pendingQuery.isError && items.length === 0 && (
        <div className="text-center py-16 sm:py-20 border-2 border-dashed rounded-3xl bg-muted/10">
          <h3 className="text-lg font-semibold mb-2">
            {status === "all" ? "Nenhum artigo encontrado" : `Nenhum artigo ${statusMeta[status]?.label?.toLowerCase?.() ?? "encontrado"}`}
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Nenhum resultado para os filtros selecionados.
          </p>
        </div>
      )}

      {!pendingQuery.isLoading && !pendingQuery.isError && items.length > 0 && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl relative overflow-hidden group/bulk">
             <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover/bulk:opacity-100 transition-opacity duration-500" />
            <div className="flex items-center gap-4 relative z-10">
              <input
                type="checkbox"
                className="h-5 w-5 rounded-md border-white/20 bg-white/5 cursor-pointer accent-primary"
                checked={items.length > 0 && items.every((a) => selectedIds.has(a.id))}
                onChange={toggleSelectAll}
                aria-label="Selecionar todos"
              />
              <div className="text-sm font-bold tracking-tight">
                {selectedCount > 0 ? `${selectedCount} item(ns) selecionado(s)` : `${items.length} resultado(s)`}
              </div>
            </div>
            {status === "pending" && (
              <div className="flex items-center gap-2 sm:gap-3 relative z-10 flex-wrap">
                <Button
                  type="button"
                  className="rounded-xl h-9 sm:h-11 px-4 sm:px-6 font-black uppercase tracking-widest text-[10px] sm:text-[11px] shadow-lg shadow-primary/20"
                  disabled={selectedCount === 0 || isMutating}
                  onClick={() => {
                    const slugs = items.filter((a) => selectedIds.has(a.id)).map((a) => a.slug)
                    bulkApproveMutation.mutate(slugs)
                  }}
                >
                  {bulkApproveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4 mr-1 sm:mr-2" aria-hidden="true" />}
                  Aprovar Lote
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="rounded-xl h-9 sm:h-11 px-4 sm:px-6 font-black uppercase tracking-widest text-[10px] sm:text-[11px] shadow-lg shadow-rose-500/20"
                  disabled={selectedCount === 0 || isMutating}
                  onClick={() => openReject(items.filter((a) => selectedIds.has(a.id)))}
                >
                  <X className="h-4 w-4 mr-1 sm:mr-2" aria-hidden="true" />
                  Rejeitar Lote
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" role="list" aria-label="Posts">
            {items.map((a) => (
              <div key={a.id} className="group/item relative rounded-[2rem] border border-white/5 bg-white/5 hover:bg-white/10 transition-all duration-500 p-6 shadow-xl" role="listitem">
                <div className="flex items-start gap-5">
                  <div className="pt-2">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded-md border-white/20 bg-white/5 cursor-pointer accent-primary"
                      checked={selectedIds.has(a.id)}
                      onChange={() => toggleSelect(a.id)}
                      aria-label={`Selecionar ${a.title}`}
                    />
                  </div>
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {(() => {
                        const s = String(a.status || status || "").toLowerCase()
                        const meta = statusMeta[s] ?? { label: s || "Status", badge: "bg-white/10 text-foreground/70" }
                        return (
                          <Badge
                            variant="secondary"
                            className={cn("rounded-full px-4 py-1 text-[9px] font-black uppercase tracking-widest border border-white/10 shadow-sm", meta.badge)}
                          >
                            {meta.label}
                          </Badge>
                        )
                      })()}
                      {a.category_name && (
                        <Badge variant="outline" className="rounded-full px-4 py-1 text-[9px] font-black uppercase tracking-widest border-white/10 bg-white/5">
                          {a.category_name}
                        </Badge>
                      )}
                    </div>
                    <div className="font-black text-xl tracking-tighter leading-tight group-hover/item:text-primary transition-colors">{a.title}</div>
                    <div className="text-sm text-muted-foreground font-medium line-clamp-2 leading-relaxed">
                      {a.excerpt || "Sem resumo editorial disponível."}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                      Autor: <span className="text-foreground/70">{a.author_name || "Desconhecido"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" asChild className="rounded-xl h-10 px-4 font-bold text-primary bg-primary/5 hover:bg-primary/10 border border-primary/10">
                      <Link href={`/dashboard/blog/${encodeURIComponent(a.slug)}/preview`}>Ver</Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild className="rounded-xl h-10 px-3 font-bold text-muted-foreground bg-white/5 hover:bg-white/10 border border-white/10">
                      <Link href={`/blog/${encodeURIComponent(a.slug)}/editar`}><Pencil className="h-4 w-4" /></Link>
                    </Button>
                  </div>
                </div>

                {(String(a.status || "").toLowerCase() === "pending" || status === "pending") && (
                  <div className="mt-4 sm:mt-6 flex gap-2 sm:gap-3">
                    <Button
                      type="button"
                      className="flex-1 rounded-xl h-9 sm:h-11 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/10"
                      disabled={isMutating}
                      onClick={() => approveMutation.mutate(a.slug)}
                    >
                      {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4 mr-1 sm:mr-2" aria-hidden="true" />}
                      Aprovar
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="flex-1 rounded-xl h-9 sm:h-11 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-500/10"
                      disabled={isMutating}
                      onClick={() => openReject([a])}
                    >
                      <X className="h-4 w-4 mr-1 sm:mr-2" aria-hidden="true" /> Rejeitar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {pendingQuery.hasNextPage && (
            <div className="flex items-center justify-center pt-2">
              <button
                type="button"
                className="h-10 px-6 rounded-full border bg-background hover:bg-muted transition-colors disabled:opacity-50"
                onClick={() => pendingQuery.fetchNextPage()}
                disabled={pendingQuery.isFetchingNextPage}
                aria-label="Carregar mais pendentes"
              >
                {pendingQuery.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
              </button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Rejeitar artigo"
        description="Informe o motivo da rejeição (opcional). Isso ajuda o autor a corrigir o conteúdo."
        confirmLabel={
          (rejectMutation.isPending || bulkRejectMutation.isPending)
            ? undefined
            : "Rejeitar"
        }
        variant="warning"
        isPending={isMutating}
        onConfirm={submitReject}
      >
        <div className="space-y-2">
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motivo da rejeição..."
            className="min-h-[120px]"
          />
        </div>
      </ConfirmDialog>
    </section>
  )
}
