import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Eye, ArrowLeft, Pencil } from "lucide-react";
export const dynamic = "force-dynamic";

import { getAccessToken } from "@/lib/auth-cookies";
import { backendFetch } from "@/lib/backend";
import { ArticleContent } from "@/components/articles/article-content";
import { sanitizeRichTextHtml } from "@/lib/sanitize-html";
import { fixImageUrl } from "@/lib/utils";

type PostDetail = {
  id: string; title: string; slug: string; excerpt: string;
  content: string; author_name: string; author_username?: string | null;
  author_bio?: string | null; author_avatar_url?: string | null;
  status: string; is_public: boolean; is_featured: boolean;
  published_at: string | null; created_at: string;
  read_time_minutes: number; image: string | null;
  tags: { id: string; name: string; slug: string }[];
  category: { id: string; name: string; slug: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  pending: "Aguardando revisão",
  rejected: "Rejeitado",
  scheduled: "Agendado",
  published: "Publicado",
  archived: "Arquivado",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "rv-badge-purple",
  pending: "rv-badge-gold",
  rejected: "rv-badge-red",
  scheduled: "rv-badge-cyan",
  published: "rv-badge-green",
  archived: "",
};

export default async function ArticlePreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getAccessToken();
  if (!access) redirect("/login");

  const res = await backendFetch<PostDetail>(
    `/api/v1/blog/posts/${encodeURIComponent(slug)}/`,
    { method: "GET", accessToken: access, cache: "no-store" }
  );

  if (!res.ok) {
    if (res.error.status === 404) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center px-4">
          <p className="text-[var(--rv-text-muted)]">Post não encontrado ou sem permissão.</p>
          <Link href="/dashboard/blog" className="rv-btn rv-btn-ghost h-9 px-4 text-xs">
            ← Voltar
          </Link>
        </div>
      );
    }
    if (res.error.status === 401 || res.error.status === 403) redirect("/login");
    throw new Error("Falha ao carregar o post.");
  }

  const post = res.data;
  const statusLabel = STATUS_LABELS[post.status] ?? post.status;
  const statusColor = STATUS_COLORS[post.status] ?? "";

  return (
    <div className="relative min-h-screen">
      {/* Preview banner */}
      <div className="sticky top-0 z-40 border-b border-[var(--rv-accent)]/30 bg-[var(--rv-accent)]/10 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-[var(--rv-accent)]" />
            <span className="rv-label text-[10px] text-[var(--rv-accent)] tracking-widest uppercase">Pré-visualização</span>
            <span className={`rv-badge text-[9px] ${statusColor}`}>{statusLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/blog/${encodeURIComponent(slug)}/editar`}
              className="rv-btn rv-btn-ghost h-7 px-3 text-[10px] flex items-center gap-1.5"
            >
              <Pencil className="h-3 w-3" /> Editar
            </Link>
            <Link
              href="/dashboard/blog"
              className="rv-btn rv-btn-ghost h-7 px-3 text-[10px] flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3 w-3" /> Painel
            </Link>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        {/* Tags / category */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {post.category && (
            <span className="rv-badge rv-badge-purple">{post.category.name}</span>
          )}
          {post.is_featured && <span className="rv-badge rv-badge-gold">⭐ Destaque</span>}
          {post.tags?.map((t) => (
            <span key={t.id} className="rv-badge rv-badge-cyan">{t.name}</span>
          ))}
        </div>

        {/* Title */}
        <h1 className="rv-display text-3xl sm:text-4xl md:text-5xl text-[var(--rv-text-primary)] leading-tight mb-6">
          {post.title}
        </h1>

        {/* Author + meta */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-[var(--rv-accent)] to-[var(--rv-cyan)]">
              {post.author_avatar_url ? (
                <Image
                  src={fixImageUrl(post.author_avatar_url) ?? ""}
                  alt={post.author_name}
                  fill sizes="40px"
                  className="object-cover"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-white font-black text-sm">
                  {(post.author_name ?? "?")[0].toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <div className="rv-label text-[10px] text-[var(--rv-text-dim)]">Autor</div>
              <div className="text-sm font-semibold text-[var(--rv-text-primary)]">{post.author_name}</div>
              {post.author_bio && (
                <p className="text-[11px] text-[var(--rv-text-dim)] mt-0.5 line-clamp-1 max-w-xs">{post.author_bio}</p>
              )}
            </div>
          </div>
          <div className="rv-divider hidden sm:block" style={{ width: "1px", height: "32px", background: "var(--rv-border)" }} />
          <div className="flex flex-wrap gap-4">
            <div>
              <div className="rv-label text-[9px] text-[var(--rv-text-dim)]">Criado</div>
              <div className="text-xs text-[var(--rv-text-muted)]">
                {new Date(post.created_at).toLocaleDateString("pt-BR", { year: "numeric", month: "short", day: "numeric" })}
              </div>
            </div>
            <div>
              <div className="rv-label text-[9px] text-[var(--rv-text-dim)]">Leitura</div>
              <div className="text-xs text-[var(--rv-text-muted)]">{post.read_time_minutes} min</div>
            </div>
          </div>
        </div>

        {/* Cover image */}
        {post.image && (
          <div className="relative w-full aspect-video overflow-hidden rounded-2xl border border-[var(--rv-border)] mb-10">
            <Image
              src={fixImageUrl(post.image) ?? ""}
              alt={post.title}
              fill
              sizes="(max-width: 896px) 100vw, 896px"
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* Excerpt */}
        {post.excerpt && (
          <p
            className="text-[var(--rv-text-muted)] text-base sm:text-lg leading-relaxed mb-8 border-l-2 border-[var(--rv-accent)] pl-4 whitespace-pre-line"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {post.excerpt}
          </p>
        )}

        {/* Content */}
        <article className="rv-card p-6 sm:p-10 mb-10">
          <ArticleContent
            html={sanitizeRichTextHtml(post.content)}
            className="rv-article-body prose prose-base sm:prose-lg prose-invert max-w-none
              prose-p:text-[var(--rv-text-muted)]
              prose-li:text-[var(--rv-text-muted)]
              prose-headings:text-[var(--rv-text-primary)] prose-headings:font-black prose-headings:tracking-tight
              prose-h2:rv-display prose-h3:rv-display
              prose-a:text-[var(--rv-accent)] prose-a:no-underline hover:prose-a:underline
              prose-code:text-[var(--rv-cyan)] prose-code:bg-[var(--rv-surface-2)] prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm
              prose-pre:bg-[var(--rv-surface-2)] prose-pre:border prose-pre:border-[var(--rv-border)] prose-pre:rounded-xl
              prose-blockquote:border-l-[var(--rv-accent)] prose-blockquote:text-[var(--rv-text-muted)] prose-blockquote:not-italic prose-blockquote:pl-4
              prose-strong:text-[var(--rv-text-primary)] prose-em:text-[var(--rv-accent)]
              prose-ul:text-[var(--rv-text-muted)] prose-ol:text-[var(--rv-text-muted)]
              prose-hr:border-[var(--rv-border)]"
          />
        </article>
      </div>
    </div>
  );
}
