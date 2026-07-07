import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";

import { BlogComments } from "@/components/blog-comments";
import { BlogPostActions } from "@/app/blog/[slug]/blog-post-actions";
import { JsonLd } from "@/components/json-ld";
import { AboutAuthor } from "@/components/articles/about-author";
import { ArticleContent } from "@/components/articles/article-content";
import { backendFetch } from "@/lib/backend";
import { getSiteBaseUrl } from "@/lib/env";
import { sanitizeRichTextHtml } from "@/lib/sanitize-html";
import { fixImageUrl } from "@/lib/utils";

type BlogPostListItem = {
  slug: string; title: string; excerpt: string;
  author_name: string; category_name: string;
  published_at: string | null; read_time_minutes: number; image: string | null;
};

type BlogPostDetail = {
  id: string; title: string; slug: string; excerpt: string;
  content: string; author_name: string; author_username?: string | null; author_id?: string | null;
  author_bio?: string | null; author_avatar_url?: string | null;
  status?: string; is_featured: boolean;
  published_at: string | null; created_at: string; updated_at: string;
  view_count: number; read_time_minutes: number;
  meta_title: string; meta_description: string; meta_keywords: string;
  image: string | null;
  tags: { id: string; name: string; slug: string }[];
  category: { id: string; name: string; slug: string };
  previous_post?: { id: string; title: string; slug: string } | null;
  next_post?: { id: string; title: string; slug: string } | null;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const res = await backendFetch<BlogPostDetail>(`/api/v1/blog/public/posts/${encodeURIComponent(slug)}/`, {
    method: "GET", cache: "force-cache", next: { revalidate: 60, tags: [`blog:post:${slug}`] },
  });
  if (!res.ok) return { title: "Post | RAVEN Blog" };
  const post = res.data;
  const title = post.meta_title?.trim() ? post.meta_title : post.title;
  const description = post.meta_description?.trim() ? post.meta_description : post.excerpt;
  return {
    title: `${title} | RAVEN Blog`,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: { title, description, type: "article", images: post.image ? [{ url: post.image }] : undefined },
    twitter: { card: post.image ? "summary_large_image" : "summary", title, description },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await backendFetch<BlogPostDetail>(`/api/v1/blog/public/posts/${encodeURIComponent(slug)}/`, {
    method: "GET", cache: "force-cache", next: { revalidate: 60, tags: [`blog:post:${slug}`] },
  });

  if (!res.ok) {
    if (res.error.status === 404) notFound();
    throw new Error("Falha ao carregar o post.");
  }

  const post = res.data;

  // Fetch up to 4 posts from the same category, then drop the current one
  const relatedRes = post.category?.slug
    ? await backendFetch<{ results: BlogPostListItem[] }>(
        `/api/v1/blog/public/posts/?category=${encodeURIComponent(post.category.slug)}&page_size=4`,
        { method: "GET", next: { revalidate: 120 } },
      )
    : null;
  const related = (relatedRes?.ok ? relatedRes.data.results : []).filter(
    (p) => p.slug !== post.slug,
  ).slice(0, 3);

  const publishedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("pt-BR", { year: "numeric", month: "long", day: "numeric" })
    : new Date(post.created_at).toLocaleDateString("pt-BR", { year: "numeric", month: "long", day: "numeric" });

  const base = getSiteBaseUrl();
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    url: `${base}/blog/${post.slug}`,
    datePublished: post.published_at ?? post.created_at,
    dateModified: post.updated_at,
    author: {
      "@type": "Person",
      name: post.author_name,
      ...(post.author_username ? { url: `${base}/u/${post.author_username}` } : {}),
    },
    publisher: { "@type": "Organization", name: "Projeto Raven", url: base },
    ...(post.image ? { image: post.image } : {}),
  };

  return (
    <div className="relative min-h-screen">
      <JsonLd data={articleSchema} />
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8 sm:py-14 sm:px-6 lg:px-8">
        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-2 mb-8 rv-label text-[9px] text-[var(--rv-text-dim)] flex-wrap">
          <Link href="/" className="hover:text-[var(--rv-accent)] transition-colors">Início</Link>
          <span>›</span>
          <Link href="/blog" className="hover:text-[var(--rv-accent)] transition-colors">Blog</Link>
          {post.category?.slug && (
            <>
              <span>›</span>
              <Link href={`/blog?category=${encodeURIComponent(post.category.slug)}`}
                className="hover:text-[var(--rv-accent)] transition-colors">
                {post.category.name}
              </Link>
            </>
          )}
          <span>›</span>
          <span className="text-[var(--rv-text-muted)] truncate max-w-[200px]">{post.title}</span>
        </nav>

        {/* ── Meta badges ── */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {post.category?.slug && (
            <Link href={`/blog?category=${encodeURIComponent(post.category.slug)}`}
              className="rv-badge rv-badge-purple hover:opacity-80 transition-opacity">
              {post.category.name}
            </Link>
          )}
          {post.is_featured && <span className="rv-badge rv-badge-gold">⭐ Destaque</span>}
          {post.tags?.map((t) => (
            <Link key={t.id} href={`/blog?tag=${encodeURIComponent(t.slug)}`}
              className="rv-badge rv-badge-cyan hover:opacity-80">
              {t.name}
            </Link>
          ))}
        </div>

        {/* ── Title ── */}
        <h1 className="rv-article-title text-3xl sm:text-4xl md:text-5xl text-[var(--rv-text-primary)] mb-6">
          {post.title}
        </h1>

        {/* ── Author + meta ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-[var(--rv-accent)] to-[var(--rv-cyan)]">
              {post.author_avatar_url ? (
                <Image
                  src={fixImageUrl(post.author_avatar_url) ?? ""}
                  alt={post.author_name}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-white font-black text-sm">
                  {post.author_name[0].toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <div className="rv-label text-[10px] text-[var(--rv-text-dim)]">Autor</div>
              {post.author_username ? (
                <Link href={`/u/${post.author_username}`} className="text-sm font-semibold text-[var(--rv-text-primary)] hover:text-[var(--rv-accent)] transition-colors">
                  {post.author_name}
                </Link>
              ) : (
                <div className="text-sm font-semibold text-[var(--rv-text-primary)]">{post.author_name}</div>
              )}
              {post.author_bio && (
                <p className="text-[11px] text-[var(--rv-text-dim)] mt-0.5 line-clamp-1 max-w-xs">
                  {post.author_bio}
                </p>
              )}
            </div>
          </div>
          <div className="rv-divider hidden sm:block w-px h-8 bg-[var(--rv-border)]" />
          <div className="flex flex-wrap gap-4">
            <div>
              <div className="rv-label text-[9px] text-[var(--rv-text-dim)]">Publicado</div>
              <div className="text-xs text-[var(--rv-text-muted)]">{publishedDate}</div>
            </div>
            <div>
              <div className="rv-label text-[9px] text-[var(--rv-text-dim)]">Leitura</div>
              <div className="text-xs text-[var(--rv-text-muted)]">{post.read_time_minutes} min</div>
            </div>
            <div>
              <div className="rv-label text-[9px] text-[var(--rv-text-dim)]">Visualizações</div>
              <div className="text-xs text-[var(--rv-text-muted)]">{post.view_count}</div>
            </div>
          </div>
        </div>

        {/* ── Cover image — 16:9, largura da coluna, antes do corpo ── */}
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

        {/* ── Abstract ── */}
        {post.excerpt ? (
          <section className="rv-card rv-paper p-5 sm:p-7 mb-10">
            <div className="rv-label text-[9px] text-[var(--rv-text-dim)]">Resumo</div>
            <p className="rv-article-abstract mt-2 text-[var(--rv-text-muted)] text-sm sm:text-base leading-relaxed whitespace-pre-line">
              {post.excerpt}
            </p>
            {post.tags?.length ? (
              <div className="mt-4 text-sm text-[var(--rv-text-muted)]">
                <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">Palavras-chave</span>
                <span className="text-[var(--rv-text-dim)]">: </span>
                <span>{post.tags.map((t) => t.name).join(", ")}</span>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ── Content ── */}
        <article className="rv-card rv-paper p-6 sm:p-10 mb-10">
          <ArticleContent
            html={sanitizeRichTextHtml(post.content)}
            className="rv-article-body rv-article-academic prose prose-base sm:prose-lg prose-invert max-w-none
              prose-p:text-[var(--rv-text-muted)]
              prose-li:text-[var(--rv-text-muted)]
              prose-headings:text-[var(--rv-text-primary)] prose-headings:font-semibold prose-headings:tracking-tight
              prose-a:text-[var(--rv-accent)] prose-a:no-underline hover:prose-a:underline
              prose-code:text-[var(--rv-cyan)] prose-code:bg-[var(--rv-surface-2)] prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm
              prose-pre:bg-[var(--rv-surface-2)] prose-pre:border prose-pre:border-[var(--rv-border)] prose-pre:rounded-xl
              prose-blockquote:border-l-[var(--rv-accent)] prose-blockquote:text-[var(--rv-text-muted)] prose-blockquote:not-italic prose-blockquote:pl-4
              prose-strong:text-[var(--rv-text-primary)] prose-em:text-[var(--rv-accent)]
              prose-ul:text-[var(--rv-text-muted)] prose-ol:text-[var(--rv-text-muted)]
              prose-hr:border-[var(--rv-border)]"
          />
        </article>

        {(post.previous_post || post.next_post) && (
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            {post.previous_post ? (
              <Link
                href={`/blog/${encodeURIComponent(post.previous_post.slug)}`}
                prefetch={false}
                className="rv-card p-5 hover:border-[var(--rv-accent)]/40 transition-colors"
              >
                <div className="rv-label text-[9px] text-[var(--rv-text-dim)] mb-2">Parte anterior</div>
                <div className="text-sm font-semibold text-[var(--rv-text-primary)] hover:text-[var(--rv-accent)] transition-colors">
                  ← {post.previous_post.title}
                </div>
              </Link>
            ) : (
              <div className="hidden sm:block" />
            )}
            {post.next_post ? (
              <Link
                href={`/blog/${encodeURIComponent(post.next_post.slug)}`}
                prefetch={false}
                className="rv-card p-5 hover:border-[var(--rv-accent)]/40 transition-colors text-left sm:text-right"
              >
                <div className="rv-label text-[9px] text-[var(--rv-text-dim)] mb-2">Continuação</div>
                <div className="text-sm font-semibold text-[var(--rv-text-primary)] hover:text-[var(--rv-accent)] transition-colors">
                  {post.next_post.title} →
                </div>
              </Link>
            ) : (
              <div className="hidden sm:block" />
            )}
          </section>
        )}

        {/* ── Author card ── */}
        {post.author_username && (
          <AboutAuthor author={{
            id: post.author_id ?? undefined,
            username: post.author_username,
            full_name: post.author_name,
            avatar_url: post.author_avatar_url,
            bio: post.author_bio,
          }} />
        )}

        {/* ── Author/Editor actions ── */}
        <BlogPostActions slug={post.slug} status={post.status} authorId={post.author_id ?? null} />

        {/* ── Footer nav ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
          <Link href="/blog" className="rv-btn rv-btn-ghost text-xs px-6 h-10 gap-2">
            ← Voltar ao Blog
          </Link>
          <div className="flex flex-wrap gap-2">
            {post.tags?.map((t) => (
              <Link key={t.id} href={`/blog?tag=${encodeURIComponent(t.slug)}`}
                className="rv-badge rv-badge-cyan hover:opacity-80 text-[9px]">
                {t.name}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Related articles ── */}
        {related.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <span className="rv-badge rv-badge-purple">◈ Leia também</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="rv-card group flex flex-col gap-3 p-4 hover:scale-[1.02] transition-all duration-200"
                >
                  {r.image && (
                    <div className="relative h-32 rounded-lg overflow-hidden">
                      <Image src={fixImageUrl(r.image) ?? ""} alt={r.title} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="rv-display text-sm text-[var(--rv-text-primary)] group-hover:text-[var(--rv-accent)] transition-colors line-clamp-2 mb-1">
                      {r.title}
                    </h3>
                    <p className="text-[10px] text-[var(--rv-text-dim)] line-clamp-2 font-[var(--font-body)]">
                      {r.excerpt}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-[var(--rv-text-dim)]">
                    <span>{r.read_time_minutes} min</span>
                    <span className="text-[var(--rv-accent)] group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Comments ── */}
        <div className="rv-card p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="rv-badge rv-badge-purple">💬 Comentários</span>
          </div>
          <BlogComments postId={post.id} postSlug={post.slug} />
        </div>
      </div>
    </div>
  );
}
