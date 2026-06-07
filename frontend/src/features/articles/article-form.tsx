"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { useForm, useWatch, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { Article, Category, Tag } from "@/types"
import {
  Loader2, ArrowLeft, Image as ImageIcon, X, Globe, MessageSquareQuote,
  Layout, CheckCircle2, XCircle, Send, Sparkles, Link as LinkIcon, Lock, Trash2, Calendar, Star,
} from "lucide-react"
import dynamic from "next/dynamic"
const RichEditor = dynamic(
  () => import("@/components/ui/rich-editor").then(m => m.RichEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 flex items-center justify-center border border-[var(--rv-border)] rounded-xl bg-[var(--rv-surface-2)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--rv-text-dim)]" />
      </div>
    ),
  }
)
import { PreviewDialog } from "@/components/cms/preview-dialog"
import { MediaDialog } from "@/features/media/media-dialog"
import { Progress } from "@/components/ui/progress"
import { notify } from "@/lib/notifications"
import { ArticleHistory } from "@/features/articles/article-history"
import { ArticleComments } from "@/features/articles/article-comments"
import { ArticleContent } from "@/components/articles/article-content"
import { sanitizeRichTextHtml } from "@/lib/sanitize-html"

function clearEditorDraft(id: string | number | undefined) {
  if (id === undefined || id === null) return
  try {
    localStorage.removeItem(`rv-editor-draft-${id}`)
  } catch {
  }
}
import { useAuth } from "@/hooks/use-auth"
import { slugify, fixImageUrl } from "@/lib/utils"
import { ConfirmDialog } from "@/components/rv-confirm-dialog"

// ── Status badge config ────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  draft:     { label: 'Rascunho',  cls: 'rv-badge' },
  pending:   { label: 'Revisão',   cls: 'rv-badge rv-badge-gold' },
  scheduled: { label: 'Agendado',  cls: 'rv-badge rv-badge-purple' },
  published: { label: 'Publicado', cls: 'rv-badge rv-badge-cyan' },
  rejected:  { label: 'Rejeitado', cls: 'rv-badge rv-badge-red' },
  archived:  { label: 'Arquivado', cls: 'rv-badge rv-badge-red' },
} as const

// ── Sub-components ─────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-red-400 mt-1" role="alert">{message}</p>
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-[var(--rv-text-dim)] mt-1">{children}</p>
}

function CheckItem({ ok, label, note }: { ok: boolean; label: string; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-[var(--rv-text-primary)]">
        {ok
          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
          : <XCircle className="h-4 w-4 text-red-400" aria-hidden="true" />
        }
        <span>{label}</span>
      </div>
      {note && <span className="text-[9px] text-[var(--rv-text-dim)] uppercase tracking-widest">{note}</span>}
    </div>
  )
}

// ── Schema ─────────────────────────────────────────────────────────────────────

const formSchema = z.object({
  title: z.string().min(5, "O título deve ter pelo menos 5 caracteres."),
  slug: z.string().min(3, "O link permanente deve ter pelo menos 3 caracteres.").regex(/^[a-z0-9-]+$/, "O link deve conter apenas letras minúsculas, números e hifens."),
  content: z.string().min(10, "O conteúdo deve ter pelo menos 10 caracteres."),
  excerpt: z.string().max(500, "O resumo deve ter no máximo 500 caracteres.").optional(),
  category: z.string().optional(),
  image: z.string().optional(),
  meta_title: z.string().max(70, "O título SEO deve ter menos de 70 caracteres.").optional(),
  meta_description: z.string().max(160, "A descrição SEO deve ter menos de 160 caracteres.").optional(),
  meta_keywords: z.string().optional(),
  tags: z.array(z.string()),
  published_at: z.string().optional().nullable(),
  is_featured: z.boolean().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface ArticleFormProps {
  initialData?: Article | null
  onSuccess: (article?: Article) => void
  onCancel: () => void
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ArticleForm({ initialData, onSuccess, onCancel }: ArticleFormProps) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canPublish = Boolean(
    (user as { is_blog_editor?: boolean; is_staff?: boolean; is_superuser?: boolean } | null)?.is_blog_editor ||
    (user as { is_blog_editor?: boolean; is_staff?: boolean; is_superuser?: boolean } | null)?.is_staff ||
    (user as { is_blog_editor?: boolean; is_staff?: boolean; is_superuser?: boolean } | null)?.is_superuser
  )

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch('/api/blog-admin/categories/')
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json() as Category[] | { results: Category[] }
      const data = Array.isArray(json) ? json : json.results || []
      return Array.isArray(data) ? data : []
    },
    staleTime: 1000 * 60 * 10,
  })

  const { data: allTags } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const res = await fetch('/api/blog-admin/tags/')
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json() as Tag[] | { results: Tag[] }
      const data = Array.isArray(json) ? json : json.results || []
      return Array.isArray(data) ? data : []
    },
    staleTime: 1000 * 60 * 10,
  })

  // false = slug auto-gerado do título (read-only); true = editável manualmente
  // Novos posts começam em modo automático; edição começa em modo manual (slug já existe)
  const [slugManual, setSlugManual] = useState(Boolean(initialData))
  const [deleteOpen, setDeleteOpen] = useState(false)
  // Slug do post recém-criado (permite preview antes de redirecionar)
  const [createdSlug, setCreatedSlug] = useState<string | null>(null)
  const [autoOpenPreview, setAutoOpenPreview] = useState(false)
  const previewAfterSaveRef = useRef(false)
  const submitAfterCreateRef = useRef(false)
  const lastSavedArticleRef = useRef<Article | null>(null)
  const effectiveSlug = initialData?.slug ?? createdSlug
  const [splitPreview, setSplitPreview] = useState(false)

  const normalizeTagIds = (raw: unknown): string[] => {
    if (!Array.isArray(raw)) return []
    return raw.map((t) => (typeof t === 'object' && t !== null ? (t as { id: string }).id : String(t)))
  }

  const initialTagIds = normalizeTagIds(initialData?.tags)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title ?? "",
      slug: initialData?.slug ?? "",
      content: initialData?.content ?? "",
      excerpt: initialData?.excerpt ?? "",
      category: initialData?.category
        ? (typeof initialData.category === 'object' ? (initialData.category as { id: string }).id : String(initialData.category))
        : undefined,
      image: fixImageUrl(initialData?.image) ?? "",
      meta_title: initialData?.meta_title ?? "",
      meta_description: initialData?.meta_description ?? "",
      meta_keywords: initialData?.meta_keywords ?? "",
      tags: initialTagIds,
      published_at: initialData?.published_at
        ? new Date(initialData.published_at).toISOString().slice(0, 16)
        : "",
      is_featured: initialData?.is_featured ?? false,
    },
  })

  const watchedTitle = useWatch({ control: form.control, name: "title" })
  const watchedContent = useWatch({ control: form.control, name: "content" })
  const watchedExcerpt = useWatch({ control: form.control, name: "excerpt" })
  const watchedCategory = useWatch({ control: form.control, name: "category" })
  const watchedImage = useWatch({ control: form.control, name: "image" })
  const watchedMetaTitle = useWatch({ control: form.control, name: "meta_title" })
  const watchedMetaDescription = useWatch({ control: form.control, name: "meta_description" })
  const watchedSlug = useWatch({ control: form.control, name: "slug" })
  const watchedPublishedAt = useWatch({ control: form.control, name: "published_at" })

  const [previewTitle, setPreviewTitle] = useState(form.getValues("title"))
  const [previewExcerpt, setPreviewExcerpt] = useState(form.getValues("excerpt") ?? "")
  const [previewImage, setPreviewImage] = useState(() => fixImageUrl(initialData?.image) ?? "")
  const [previewTags, setPreviewTags] = useState<string[]>(initialTagIds)

  useEffect(() => {
    if (initialData) return
    if (!categories || categories.length === 0) return
    if (!form.getValues("category")) {
      form.setValue("category", String(categories[0].id))
    }
  }, [categories, form, initialData])

  const handleTitleChange = (value: string) => {
    form.setValue("title", value, { shouldValidate: true })
    setPreviewTitle(value)
    if (!slugManual) {
      form.setValue("slug", slugify(value), { shouldValidate: true })
    }
  }

  // ── Mutations ───────────────────────────────────────────────────────────────

  const reviewMutation = useMutation({
    mutationFn: async ({ action, slug }: { action: 'submit' | 'publish' | 'reject'; slug: string }) => {
      const res = await fetch(`/api/blog-admin/articles/${encodeURIComponent(slug)}/${action}`, { method: "POST" })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['articles'] })
      queryClient.invalidateQueries({ queryKey: ['articles-moderation'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-articles-grid'] })
      const messages = { submit: "Post enviado para revisão", publish: "Post publicado com sucesso", reject: "Post rejeitado" }
      notify.success(messages[action], "Status atualizado.")
      onSuccess(lastSavedArticleRef.current ?? initialData ?? undefined)
    },
    onError: (error: unknown) => {
      notify.error("Falha na operação", error instanceof Error ? error.message : String(error))
    },
  })

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = { ...values, category: values.category ? String(values.category) : null }
      if (!payload.image) delete (payload as { image?: unknown }).image
      if (!payload.published_at) delete (payload as { published_at?: unknown }).published_at

      const savedSlug = initialData?.slug ?? createdSlug
      const url = savedSlug
        ? `/api/blog-admin/articles/${encodeURIComponent(savedSlug)}`
        : "/api/blog-admin/articles"
      const method = savedSlug ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw body }
      return res.json() as Promise<Article>
    },
    onSuccess: (data) => {
      clearEditorDraft(initialData?.id ?? "new-article")
      queryClient.invalidateQueries({ queryKey: ['articles'] })
      queryClient.invalidateQueries({ queryKey: ['blog-article-edit'] })
      lastSavedArticleRef.current = data
      if (previewAfterSaveRef.current) {
        previewAfterSaveRef.current = false
        setCreatedSlug(data.slug)
        setAutoOpenPreview(true)
        notify.success("Rascunho salvo", "Abrindo preview…")
        return
      }
      if (!initialData && submitAfterCreateRef.current) {
        submitAfterCreateRef.current = false
        setCreatedSlug(data.slug)
        reviewMutation.mutate({ action: "submit", slug: data.slug })
        return
      }
      notify.success(initialData ? "Post atualizado" : "Post criado", "Alterações salvas com sucesso.")
      onSuccess(data)
    },
    onError: (error: unknown) => {
      notify.error("Falha ao salvar post", error instanceof Error ? error.message : String(error))
    },
  })

  const seoMutation = useMutation({
    mutationFn: async ({ title, content }: { title: string; content: string }) => {
      const res = await fetch('/api/ai/seo-suggest/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      return res.json()
    },
    onSuccess: (data: { meta_title?: string; meta_description?: string; keywords?: string }) => {
      if (data.meta_title) form.setValue("meta_title", data.meta_title)
      if (data.meta_description) form.setValue("meta_description", data.meta_description)
      if (data.keywords) form.setValue("meta_keywords", data.keywords)
      notify.success("Sugestões de SEO geradas!", "As tags foram preenchidas por IA.")
    },
    onError: (error: unknown) => {
      notify.error("Falha ao gerar sugestões SEO", error instanceof Error ? error.message : String(error))
    },
  })

  const scheduleMutation = useMutation({
    mutationFn: async ({ slug, published_at }: { slug: string; published_at: string }) => {
      const res = await fetch(`/api/blog-admin/articles/${encodeURIComponent(slug)}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published_at }),
      })
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw body }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] })
      notify.success("Post agendado", "Será publicado automaticamente no horário configurado.")
      onSuccess()
    },
    onError: (error: unknown) => {
      notify.error("Falha ao agendar post", error instanceof Error ? error.message : String(error))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch(`/api/blog-admin/articles/${encodeURIComponent(slug)}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] })
      notify.success("Post excluído", "O post foi removido com sucesso.")
      onSuccess()
    },
    onError: (error: unknown) => {
      notify.error("Falha ao excluir post", error instanceof Error ? error.message : String(error))
    },
  })

  // ── Checklist ───────────────────────────────────────────────────────────────

  const wordCount = (watchedContent ?? "").trim() ? (watchedContent ?? "").trim().split(/\s+/).length : 0;

  const requiredChecks = {
    title: (watchedTitle ?? "").trim().length >= 5,
    slug: /^[a-z0-9-]{3,}$/.test((watchedSlug ?? "").trim()),
    content: (watchedContent ?? "").trim().length >= 10,
    category: Boolean((watchedCategory ?? "").trim()),
    excerpt: (watchedExcerpt ?? "").trim().length >= 10,
  }

  const recommendedChecks = {
    image: Boolean((watchedImage ?? "").trim()),
    meta_title: (watchedMetaTitle ?? "").trim().length >= 10 && (watchedMetaTitle ?? "").trim().length <= 60,
    meta_description: (watchedMetaDescription ?? "").trim().length >= 50 && (watchedMetaDescription ?? "").trim().length <= 160,
    word_count: wordCount >= 300,
  }

  const isReadyForReview = Object.values(requiredChecks).every(Boolean)
  const isReadyForPublish = isReadyForReview && recommendedChecks.meta_description && recommendedChecks.meta_title
  const healthPercent = Math.round(
    ((Object.values(requiredChecks).filter(Boolean).length + Object.values(recommendedChecks).filter(Boolean).length) /
      (Object.keys(requiredChecks).length + Object.keys(recommendedChecks).length)) * 100
  )

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleReviewAction = (action: "submit" | "publish" | "reject") => {
    if (!initialData) return
    const status = initialData.status

    if (action === "submit") {
      if (!isReadyForReview) { notify.warning("Checklist incompleto", "Preencha os campos obrigatórios."); return }
      if (status !== "draft") { notify.warning("Ação indisponível", "Apenas rascunhos podem ser enviados para revisão."); return }
    }
    if (action === "publish") {
      if (!isReadyForPublish) { notify.warning("Checklist incompleto", "Complete os itens obrigatórios para publicar."); return }
      if (status !== "pending" && status !== "archived" && !canPublish) { notify.warning("Ação indisponível", "Permissão insuficiente."); return }
    }
    if (action === "reject") {
      if (status !== "pending") { notify.warning("Ação indisponível", "Apenas posts pendentes podem ser rejeitados."); return }
    }

    reviewMutation.mutate({ action, slug: initialData.slug })
  }

  const handleSchedule = () => {
    if (!initialData) return
    const publishedAt = form.getValues("published_at")
    if (!publishedAt) {
      notify.warning("Data necessária", "Configure a data de publicação no campo 'Agendar Publicação'.")
      return
    }
    const when = new Date(publishedAt)
    if (when <= new Date()) {
      notify.warning("Data inválida", "A data de publicação deve ser no futuro.")
      return
    }
    scheduleMutation.mutate({ slug: initialData.slug, published_at: when.toISOString() })
  }

  const handleAISuggest = () => {
    const title = form.getValues("title")
    const content = form.getValues("content")
    if (!title || title.length < 5 || !content || content.length < 10) {
      notify.warning("Conteúdo insuficiente", "Preencha o título e o corpo do artigo primeiro.")
      return
    }
    seoMutation.mutate({ title, content })
  }

  function onSubmit(values: FormValues) {
    mutation.mutate({
      ...values,
      published_at: values.published_at ? new Date(values.published_at).toISOString() : null,
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const statusEntry = initialData?.status
    ? STATUS_CONFIG[initialData.status as keyof typeof STATUS_CONFIG]
    : undefined

  return (
    <div className="space-y-6">
      {/* ── Sticky header ── */}
      <div className="sticky top-16 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 bg-[var(--rv-dark)] border-b border-[var(--rv-border)] py-3 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Lado esquerdo: voltar + título + badge */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Voltar"
              onClick={onCancel}
              className="h-9 w-9 flex items-center justify-center rounded-xl border border-[var(--rv-border)] hover:border-[var(--rv-accent)]/50 hover:bg-[var(--rv-accent)]/10 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-[var(--rv-text-primary)]" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="rv-display text-2xl text-[var(--rv-text-primary)]">
                {initialData ? "Editar Post" : "Novo Post"}
              </h2>
              {statusEntry && (
                <span className={statusEntry.cls}>{statusEntry.label}</span>
              )}
            </div>
          </div>

          {/* Lado direito: ações */}
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {initialData && (
              <>
                {initialData.status === 'draft' && (
                  <>
                    <button
                      type="button"
                      className="rv-btn rv-btn-ghost h-9 px-4 text-xs flex items-center gap-2"
                      onClick={() => handleReviewAction("submit")}
                      disabled={reviewMutation.isPending || !isReadyForReview}
                    >
                      <Send className="h-4 w-4" aria-hidden="true" /> Enviar para Revisão
                    </button>
                    {canPublish && watchedPublishedAt && new Date(watchedPublishedAt) > new Date() && (
                      <button
                        type="button"
                        className="h-9 px-4 text-xs flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-[var(--rv-text-primary)] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                        onClick={handleSchedule}
                        disabled={scheduleMutation.isPending}
                      >
                        <Calendar className="h-4 w-4" aria-hidden="true" /> Agendar
                      </button>
                    )}
                    {canPublish && (
                      <button
                        type="button"
                        className="h-9 px-4 text-xs flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-[var(--rv-text-primary)] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                        onClick={() => handleReviewAction("publish")}
                        disabled={reviewMutation.isPending || !isReadyForPublish}
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Publicar Agora
                      </button>
                    )}
                  </>
                )}
                {initialData.status === 'scheduled' && canPublish && (
                  <button
                    type="button"
                    className="h-9 px-4 text-xs flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-[var(--rv-text-primary)] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                    onClick={() => handleReviewAction("publish")}
                    disabled={reviewMutation.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Publicar Agora
                  </button>
                )}
                {initialData.status === 'archived' && canPublish && (
                  <button
                    type="button"
                    className="h-9 px-4 text-xs flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-[var(--rv-text-primary)] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                    onClick={() => handleReviewAction("publish")}
                    disabled={reviewMutation.isPending || !isReadyForPublish}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Republicar Post
                  </button>
                )}
                {initialData.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      className="h-9 px-4 text-xs flex items-center gap-2 rounded-xl bg-[var(--rv-red)]/10 hover:bg-[var(--rv-red)]/20 text-[var(--rv-red)] border border-[var(--rv-red)]/30 font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                      onClick={() => handleReviewAction("reject")}
                      disabled={reviewMutation.isPending}
                    >
                      <XCircle className="h-4 w-4" aria-hidden="true" /> Rejeitar
                    </button>
                    <button
                      type="button"
                      className="h-9 px-4 text-xs flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-[var(--rv-text-primary)] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                      onClick={() => handleReviewAction("publish")}
                      disabled={reviewMutation.isPending || !isReadyForPublish}
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Aprovar
                    </button>
                  </>
                )}
              </>
            )}

            {initialData && (
              <>
                <ArticleHistory articleSlug={initialData.slug} />
                <ArticleComments articleId={initialData.id} />
                <button
                  type="button"
                  aria-label="Excluir post"
                  className="h-9 w-9 flex items-center justify-center rounded-xl bg-[var(--rv-red)]/10 hover:bg-[var(--rv-red)]/20 border border-[var(--rv-red)]/30 text-[var(--rv-red)] transition-colors"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
                <ConfirmDialog
                  open={deleteOpen}
                  onClose={() => setDeleteOpen(false)}
                  title="Você tem certeza?"
                  description={`Esta ação não pode ser desfeita. Isso excluirá permanentemente o post "${initialData.title}".`}
                  confirmLabel={deleteMutation.isPending ? "Excluindo..." : "Excluir"}
                  onConfirm={() => deleteMutation.mutate(initialData.slug)}
                  isPending={deleteMutation.isPending}
                  variant="danger"
                />
              </>
            )}

            {/* Preview — disponível sempre; cria rascunho automaticamente se post ainda não existe */}
            {effectiveSlug ? (
              <PreviewDialog
                slug={effectiveSlug}
                href={`/blog/${encodeURIComponent(effectiveSlug)}`}
                defaultOpen={autoOpenPreview}
                trigger={
                  <button
                    type="button"
                    className="rv-btn rv-btn-ghost h-9 px-4 text-xs"
                    onClick={() => setAutoOpenPreview(false)}
                  >
                    Preview
                  </button>
                }
              />
            ) : (
              <button
                type="button"
                className="rv-btn rv-btn-ghost h-9 px-4 text-xs disabled:opacity-50"
                disabled={mutation.isPending}
                onClick={() => {
                  previewAfterSaveRef.current = true
                  void form.handleSubmit(onSubmit)()
                }}
              >
                {mutation.isPending && previewAfterSaveRef.current
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" aria-hidden="true" />
                  : null}
                Preview
              </button>
            )}

            <button
              type="button"
              onClick={form.handleSubmit(onSubmit)}
              disabled={mutation.isPending}
              className="rv-btn rv-btn-primary h-9 px-6 text-xs disabled:opacity-50"
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden="true" />}
              {initialData ? "Salvar" : "Criar Post"}
            </button>

            {!initialData && (
              <button
                type="button"
                onClick={() => {
                  submitAfterCreateRef.current = true
                  void form.handleSubmit(onSubmit)()
                }}
                disabled={mutation.isPending || reviewMutation.isPending || !isReadyForReview}
                className="h-9 px-4 text-xs flex items-center gap-2 rounded-xl bg-[var(--rv-gold)]/10 hover:bg-[var(--rv-gold)]/20 text-[var(--rv-gold)] border border-[var(--rv-gold)]/30 font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden="true" /> Criar e enviar p/ revisão
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Form grid ── */}
      <form
        onSubmit={(e) => { e.preventDefault(); void form.handleSubmit(onSubmit)() }}
        noValidate
        className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20"
      >
        {/* ── Coluna principal ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Título */}
          <div className="rv-card p-6">
            <Controller
              control={form.control}
              name="title"
              render={({ field, fieldState }) => (
                <div>
                  <label htmlFor="af-title" className="rv-label-field">Título Principal</label>
                  <input
                    id="af-title"
                    name={field.name}
                    ref={field.ref}
                    className="rv-input bg-[var(--rv-surface-2)] h-14 text-xl font-black"
                    placeholder="Título do post"
                    value={field.value}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    onBlur={field.onBlur}
                    aria-describedby={fieldState.error ? "af-title-error" : undefined}
                  />
                  {fieldState.error && (
                    <p id="af-title-error" className="text-xs text-red-400 mt-1" role="alert">
                      {fieldState.error.message}
                    </p>
                  )}
                </div>
              )}
            />
          </div>

          {/* Conteúdo — RichEditor não expõe id nativo; usamos aria-labelledby */}
          <div className="rv-card p-6">
            <Controller
              control={form.control}
              name="content"
              render={({ field, fieldState }) => (
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div id="af-content-label" className="rv-label-field" aria-hidden="true">
                      Corpo do Post
                    </div>
                    <button
                      type="button"
                      className={`h-9 px-4 text-[10px] uppercase tracking-widest rounded-xl border transition-colors ${splitPreview ? "border-[var(--rv-accent)]/40 text-[var(--rv-accent)] bg-[color-mix(in_srgb,var(--rv-accent)_10%,transparent)]" : "border-[var(--rv-border)] text-[var(--rv-text-dim)] hover:text-[var(--rv-text-primary)]"}`}
                      onClick={() => setSplitPreview((v) => !v)}
                    >
                      {splitPreview ? "Ocultar preview" : "Preview lado a lado"}
                    </button>
                  </div>

                  <div className={splitPreview ? "grid grid-cols-1 lg:grid-cols-2 gap-4 items-start" : ""}>
                    <div aria-labelledby="af-content-label" role="group" className={splitPreview ? "min-w-0" : ""}>
                      <RichEditor
                        id={initialData?.id || "new-article"}
                        content={field.value}
                        onChange={field.onChange}
                        placeholder="Comece a escrever sua história..."
                      />
                    </div>
                    {splitPreview && (
                      <div className="min-w-0">
                        <div className="rv-label text-[9px] text-[var(--rv-text-dim)] mb-2">Preview</div>
                        <div className="rv-card rv-paper p-6">
                          <ArticleContent
                            html={sanitizeRichTextHtml(field.value)}
                            className="rv-article-body prose prose-sm sm:prose-base dark:prose-invert max-w-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <FieldError message={fieldState.error?.message} />
                </div>
              )}
            />
          </div>

          {/* ── Seção SEO ── */}
          <div className="rv-card p-6 space-y-5">
            {/* Heading */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="h-4 w-4 text-[var(--rv-accent)]" aria-hidden="true" />
                  <h3 className="rv-display text-sm text-[var(--rv-text-primary)]">SEO &amp; Busca</h3>
                </div>
                <div className="rv-divider mb-4" />
              </div>
              <button
                type="button"
                className="flex items-center gap-2 h-8 px-3 text-xs rounded-xl border border-[var(--rv-accent)]/20 text-[var(--rv-accent)] hover:bg-[var(--rv-accent)]/10 transition-colors disabled:opacity-50"
                onClick={handleAISuggest}
                disabled={seoMutation.isPending}
              >
                {seoMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  : <Sparkles className="h-4 w-4" aria-hidden="true" />
                }
                Sugerir com IA
              </button>
            </div>

            {/* Google Search Preview */}
            <div className="rounded-xl border border-[var(--rv-border)] p-4 bg-[var(--rv-surface-2)] space-y-2">
              <p className="text-xs text-[var(--rv-text-dim)] font-medium mb-3">Pré-visualização no Google</p>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-full bg-[var(--rv-surface)] border border-[var(--rv-border)] flex items-center justify-center text-[10px] text-[var(--rv-text-dim)] overflow-hidden">
                  {previewImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={fixImageUrl(previewImage) || ""}
                      alt=""
                      className="h-full w-full object-cover"
                      aria-hidden="true"
                    />
                  ) : (
                    <Globe className="h-4 w-4" aria-hidden="true" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-[var(--rv-text-primary)] leading-tight">Seu Site</span>
                  <span className="text-xs text-[var(--rv-text-dim)] leading-tight">
                    {`https://seusite.com/blog/${watchedSlug || 'slug-do-artigo'}`}
                  </span>
                </div>
              </div>
              <p className="text-[#8ab4f8] text-lg font-medium hover:underline cursor-pointer truncate">
                {watchedMetaTitle || previewTitle || "Título do Post"}
              </p>
              <p className="text-[var(--rv-text-muted)] text-sm line-clamp-2">
                {watchedMetaDescription || previewExcerpt || "A descrição do seu artigo aparecerá aqui nos resultados de busca..."}
              </p>
            </div>

            {/* Meta Title */}
            <Controller
              control={form.control}
              name="meta_title"
              render={({ field, fieldState }) => (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="af-meta-title" className="rv-label-field">Título SEO (Meta Title)</label>
                    <span className={`text-xs ${(field.value?.length ?? 0) > 60 ? 'text-red-400 font-bold' : 'text-[var(--rv-text-dim)]'}`}>
                      {field.value?.length ?? 0}/60
                    </span>
                  </div>
                  <input
                    id="af-meta-title"
                    className="rv-input bg-[var(--rv-surface-2)]"
                    placeholder="Título como aparecerá no Google"
                    {...field}
                    value={field.value ?? ''}
                  />
                  <FieldHint>Recomendado até 60 caracteres.</FieldHint>
                  <FieldError message={fieldState.error?.message} />
                </div>
              )}
            />

            {/* Meta Description */}
            <Controller
              control={form.control}
              name="meta_description"
              render={({ field, fieldState }) => (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="af-meta-description" className="rv-label-field">Descrição SEO (Meta Description)</label>
                    <span className={`text-xs ${(field.value?.length ?? 0) > 160 ? 'text-red-400 font-bold' : 'text-[var(--rv-text-dim)]'}`}>
                      {field.value?.length ?? 0}/160
                    </span>
                  </div>
                  <textarea
                    id="af-meta-description"
                    className="rv-input bg-[var(--rv-surface-2)] resize-none min-h-24 py-3 px-4"
                    placeholder="Breve resumo para os resultados de busca..."
                    {...field}
                    value={field.value ?? ''}
                  />
                  <FieldHint>Recomendado até 160 caracteres.</FieldHint>
                  <FieldError message={fieldState.error?.message} />
                </div>
              )}
            />
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-6">

          {/* Checklist de Qualidade */}
          <div className="rv-card p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-[var(--rv-accent)]" aria-hidden="true" />
                <h3 className="rv-display text-sm text-[var(--rv-text-primary)]">Checklist de Qualidade</h3>
              </div>
              <div className="rv-divider mb-4" />
            </div>
            
            <div className="space-y-3">
              <p className="rv-label text-[9px] text-[var(--rv-text-dim)]">Obrigatório</p>
              <CheckItem ok={requiredChecks.title} label="Título (min. 5 chars)" />
              <CheckItem ok={requiredChecks.slug} label="Link permanente válido" />
              <CheckItem ok={requiredChecks.content} label="Conteúdo presente" />
              <CheckItem ok={requiredChecks.category} label="Categoria selecionada" />
              <CheckItem ok={requiredChecks.excerpt} label="Resumo do post" />
              
              <div className="pt-2">
                <p className="rv-label text-[9px] text-[var(--rv-text-dim)]">Recomendado (SEO)</p>
              </div>
              <CheckItem ok={recommendedChecks.image} label="Imagem de capa" />
              <CheckItem ok={recommendedChecks.meta_title} label="Meta Title (10-60 chars)" note={`${(watchedMetaTitle ?? "").length} chars`} />
              <CheckItem ok={recommendedChecks.meta_description} label="Meta Description (50-160)" note={`${(watchedMetaDescription ?? "").length} chars`} />
              <CheckItem ok={recommendedChecks.word_count} label="Mínimo de 300 palavras" note={`${wordCount} palavras`} />
            </div>

            <div className="pt-4 border-t border-[var(--rv-border)]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--rv-text-muted)]">Saúde do Post</span>
                <span className={`font-bold ${isReadyForPublish ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {isReadyForPublish ? 'Excelente' : isReadyForReview ? 'Bom' : 'Incompleto'}
                </span>
              </div>
              <Progress
                value={healthPercent}
                className="h-1.5 mt-2 bg-[var(--rv-surface-2)]"
                indicatorClassName={isReadyForPublish ? "bg-emerald-500" : "bg-amber-500"}
              />
            </div>
          </div>

          {/* Publicação */}
          <div className="rv-card p-5 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Layout className="h-4 w-4 text-[var(--rv-accent)]" aria-hidden="true" />
                <h3 className="rv-display text-sm text-[var(--rv-text-primary)]">Publicação</h3>
              </div>
              <div className="rv-divider mb-4" />
            </div>

            {/* Agendar */}
            <Controller
              control={form.control}
              name="published_at"
              render={({ field, fieldState }) => (
                <div>
                  <label htmlFor="af-published-at" className="rv-label-field">Agendar Publicação</label>
                  <input
                    id="af-published-at"
                    type="datetime-local"
                    className="rv-input bg-[var(--rv-surface-2)]"
                    name={field.name}
                    ref={field.ref}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                  <FieldHint>Deixe em branco para publicar imediatamente.</FieldHint>
                  <FieldError message={fieldState.error?.message} />
                </div>
              )}
            />

            {/* Checklist */}
            <div className="bg-[var(--rv-surface-2)] rounded-2xl border border-[var(--rv-border)] p-4 space-y-3">
              <div className="rv-label-field">Checklist</div>
              <div className="grid grid-cols-1 gap-2">
                <CheckItem ok={requiredChecks.title} label="Título" note="obrigatório" />
                <CheckItem ok={requiredChecks.slug} label="Slug válido" note="obrigatório" />
                <CheckItem ok={requiredChecks.content} label="Conteúdo" note="obrigatório" />
                <CheckItem ok={requiredChecks.category} label="Categoria" note="obrigatório" />
                <CheckItem ok={requiredChecks.excerpt} label="Resumo" note="obrigatório" />
                <div className="pt-2 border-t border-[var(--rv-border)] space-y-2">
                  <CheckItem ok={recommendedChecks.image} label="Imagem de capa" note="recomendado" />
                  <CheckItem ok={recommendedChecks.meta_title} label="Título SEO" note="recomendado" />
                  <CheckItem ok={recommendedChecks.meta_description} label="Descrição SEO" note="recomendado" />
                </div>
              </div>
            </div>

            {/* Featured toggle — somente editores */}
            {canPublish && (
              <Controller
                control={form.control}
                name="is_featured"
                render={({ field }) => (
                  <button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all ${
                      field.value
                        ? "border-[var(--rv-gold)]/50 bg-[var(--rv-gold)]/10 text-[var(--rv-gold)]"
                        : "border-[var(--rv-border)] text-[var(--rv-text-muted)] hover:border-[var(--rv-gold)]/40 hover:bg-[var(--rv-gold)]/5"
                    }`}
                    aria-pressed={field.value}
                  >
                    <div className="flex items-center gap-2">
                      <Star className={`h-4 w-4 ${field.value ? "fill-current" : ""}`} aria-hidden="true" />
                      <span className="text-sm font-medium">Publicação em destaque</span>
                    </div>
                    <div className={`h-5 w-9 rounded-full transition-colors relative ${field.value ? "bg-[var(--rv-gold)]" : "bg-[var(--rv-surface-2)]"}`}>
                      <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${field.value ? "translate-x-4" : "translate-x-0.5"}`} />
                    </div>
                  </button>
                )}
              />
            )}

            {/* Categoria */}
            <Controller
              control={form.control}
              name="category"
              render={({ field, fieldState }) => (
                <div>
                  <label htmlFor="af-category" className="rv-label-field">Categoria</label>
                  <div className="relative">
                    <select
                      id="af-category"
                      name={field.name}
                      ref={field.ref}
                      className="rv-input bg-[var(--rv-surface-2)] appearance-none pr-10"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                    >
                      <option value="">Selecione...</option>
                      {categories?.map((cat: Category) => (
                        <option key={cat.id} value={String(cat.id)}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--rv-text-dim)]">▾</div>
                  </div>
                  <FieldError message={fieldState.error?.message} />
                </div>
              )}
            />

            {/* Slug */}
            <Controller
              control={form.control}
              name="slug"
              render={({ field, fieldState }) => (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="af-slug" className="rv-label-field">URL Amigável (Slug)</label>
                    <button
                      type="button"
                      className="h-6 w-6 flex items-center justify-center rounded-lg border border-[var(--rv-border)] hover:border-[var(--rv-accent)]/50 hover:bg-[var(--rv-accent)]/10 transition-colors"
                      onClick={() => setSlugManual(v => !v)}
                      title={slugManual
                        ? "Gerar slug automaticamente do título"
                        : "Editar slug manualmente"
                      }
                      aria-label={slugManual
                        ? "Gerar slug automaticamente do título"
                        : "Editar slug manualmente"
                      }
                    >
                      {slugManual
                        ? <LinkIcon className="h-3 w-3 text-[var(--rv-text-dim)]" aria-hidden="true" />
                        : <Lock className="h-3 w-3 text-[var(--rv-accent)]" aria-hidden="true" />
                      }
                    </button>
                  </div>
                  <input
                    id="af-slug"
                    name={field.name}
                    ref={field.ref}
                    className={`rv-input bg-[var(--rv-surface-2)] font-mono ${!slugManual ? 'opacity-60' : ''}`}
                    placeholder="slug-do-artigo"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    readOnly={!slugManual}
                    aria-readonly={!slugManual}
                  />
                  <FieldHint>
                    {slugManual ? "Edição manual ativa." : "Auto-gerado do título."}
                  </FieldHint>
                  <FieldError message={fieldState.error?.message} />
                </div>
              )}
            />

            {/* Tags */}
            <div role="group" aria-labelledby="af-tags-label" className="space-y-3">
              <div id="af-tags-label" className="rv-label-field">Tags</div>
              <div className="flex flex-wrap gap-2">
                {allTags?.map((tag: Tag) => {
                  const isSelected = previewTags.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      aria-pressed={isSelected}
                      className={`rv-badge cursor-pointer transition-all hover:scale-105 ${isSelected ? 'rv-badge-purple' : 'opacity-60 hover:opacity-100'}`}
                      onClick={() => {
                        setPreviewTags(prev => {
                          const next = isSelected ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                          form.setValue("tags", next)
                          return next
                        })
                      }}
                    >
                      {tag.name}
                    </button>
                  )
                })}
                {!allTags?.length && (
                  <span className="text-xs text-[var(--rv-text-dim)]">Nenhuma tag disponível.</span>
                )}
              </div>
            </div>
          </div>

          {/* Mídia de Capa */}
          <div className="rv-card p-5">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ImageIcon className="h-4 w-4 text-[var(--rv-accent)]" aria-hidden="true" />
                <h3 className="rv-display text-sm text-[var(--rv-text-primary)]">Mídia de Capa</h3>
              </div>
              <div className="rv-divider mb-4" />
            </div>

            {previewImage ? (
              <div className="relative aspect-video rounded-xl overflow-hidden border border-[var(--rv-border)] group">
                <Image
                  src={fixImageUrl(previewImage) || ""}
                  alt="Imagem de capa selecionada"
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    type="button"
                    className="h-8 px-3 rounded-full text-xs flex items-center gap-1 bg-red-600/80 hover:bg-red-600 text-[var(--rv-text-primary)] transition-colors"
                    onClick={() => {
                      form.setValue("image", "")
                      setPreviewImage("")
                    }}
                  >
                    <X className="h-4 w-4" aria-hidden="true" /> Remover
                  </button>
                </div>
              </div>
            ) : (
              <MediaDialog
                onSelect={(url) => {
                  const fixed = fixImageUrl(url)
                  if (fixed) {
                    form.setValue("image", fixed)
                    setPreviewImage(fixed)
                  }
                }}
                trigger={
                  <div
                    role="button"
                    tabIndex={0}
                    className="border-2 border-dashed border-[var(--rv-border)] rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[var(--rv-accent)]/50 hover:bg-[var(--rv-accent)]/5 transition-all group"
                  >
                    <div className="h-12 w-12 rounded-full bg-[var(--rv-surface-2)] group-hover:bg-[var(--rv-accent)]/10 flex items-center justify-center mb-3 transition-colors">
                      <ImageIcon className="h-6 w-6 text-[var(--rv-text-dim)] group-hover:text-[var(--rv-accent)] transition-colors" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-medium text-[var(--rv-text-primary)]">Adicionar imagem de capa</p>
                    <p className="text-xs text-[var(--rv-text-muted)] mt-1">Recomendado: 1200×630 px</p>
                  </div>
                }
              />
            )}
          </div>

          {/* Resumo */}
          <div className="rv-card p-5 space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <MessageSquareQuote className="h-4 w-4 text-[var(--rv-accent)]" aria-hidden="true" />
                <h3 className="rv-display text-sm text-[var(--rv-text-primary)]">Resumo</h3>
              </div>
              <div className="rv-divider mb-4" />
            </div>

            <Controller
              control={form.control}
              name="excerpt"
              render={({ field, fieldState }) => (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="af-excerpt" className="rv-label-field">Resumo do artigo</label>
                    <span className={`text-xs ${(field.value?.length ?? 0) > 500 ? 'text-red-400 font-bold' : 'text-[var(--rv-text-dim)]'}`}>
                      {field.value?.length ?? 0}/500
                    </span>
                  </div>
                  <textarea
                    id="af-excerpt"
                    name={field.name}
                    ref={field.ref}
                    className="rv-input bg-[var(--rv-surface-2)] resize-none min-h-32 py-3 px-4"
                    placeholder="Escreva um breve resumo atrativo..."
                    value={field.value ?? ''}
                    onChange={(e) => {
                      field.onChange(e)
                      setPreviewExcerpt(e.currentTarget.value)
                    }}
                    onBlur={field.onBlur}
                  />
                  <FieldHint>Aparece na listagem de posts. Máximo 500 caracteres.</FieldHint>
                  <FieldError message={fieldState.error?.message} />
                </div>
              )}
            />
          </div>

        </div>
      </form>
    </div>
  )
}
