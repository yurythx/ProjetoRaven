import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

import { backendFetch } from "@/lib/backend";
import { BlogHeaderActions } from "@/app/blog/blog-header-actions";
import { BlogAdminPanel } from "@/app/blog/blog-admin-panel";
import { BlogSearchBar } from "@/app/blog/blog-search-bar";
import { BlogSidebarTaxonomy } from "@/app/blog/blog-sidebar-taxonomy";
import { fixImageUrl } from "@/lib/utils";

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

type BlogPostListItem = {
  id: string; title: string; slug: string; excerpt: string;
  author_name: string; category_name: string; category_slug: string | null;
  category_id: string | null; is_featured: boolean;
  published_at: string | null; created_at: string;
  view_count: number; read_time_minutes: number;
  image: string | null; tags: string[]; tag_slugs: string[];
};

type CategoryListItem = { id: string; name: string; slug: string; post_count: number };
type TagListItem = { id: string; name: string; slug: string };

export const metadata: Metadata = {
  title: "Blog | RAVEN",
  description: "Artigos, notícias e conteúdo publicado pela comunidade Raven.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog | RAVEN",
    description: "Artigos, notícias e conteúdo publicado pela comunidade Raven.",
    type: "website",
    url: "/blog",
  },
  twitter: { card: "summary", title: "Blog | RAVEN", description: "Artigos, notícias e conteúdo publicado pela comunidade Raven." },
};

function getParam(sp: Record<string, string | string[] | undefined> | null | undefined, key: string): string | null {
  const v = sp?.[key];
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : (v as string);
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const d = data as { results?: unknown };
    if (Array.isArray(d.results)) return d.results as T[];
  }
  return [];
}

export default async function BlogPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const sp = searchParams ?? {};
  const q = (getParam(sp, "q") ?? "").trim();
  const category = (getParam(sp, "category") ?? "").trim();
  const tag = (getParam(sp, "tag") ?? "").trim();
  const sortRaw = (getParam(sp, "sort") ?? "recent").trim();
  const sort = sortRaw === "popular" ? "popular" : "recent";
  const pageRaw = (getParam(sp, "page") ?? "1").trim();
  const page = Math.max(1, Number.parseInt(pageRaw, 10) || 1);
  const pageSize = 20;

  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("page_size", String(pageSize));
  if (q) qs.set("search", q);
  if (category) qs.set("category", category);
  if (tag) qs.set("tag", tag);
  if (sort === "popular") qs.set("ordering", "-view_count");

  const [postsRes, categoriesRes, tagsRes] = await Promise.all([
    backendFetch<Paginated<BlogPostListItem>>(`/api/v1/blog/public/posts/?${qs.toString()}`, {
      method: "GET",
      cache: "no-store",
    }),
    backendFetch<unknown>("/api/v1/blog/public/categories/", {
      method: "GET",
      cache: "no-store",
    }),
    backendFetch<unknown>("/api/v1/blog/public/tags/", {
      method: "GET",
      cache: "no-store",
    }),
  ]);

  const categories = categoriesRes.ok ? unwrapList<CategoryListItem>(categoriesRes.data) : [];
  const tags = tagsRes.ok ? unwrapList<TagListItem>(tagsRes.data) : [];

  const canPrev = postsRes.ok ? Boolean(postsRes.data.previous) : false;
  const canNext = postsRes.ok ? Boolean(postsRes.data.next) : false;

  const buildHref = (overrides: { q?: string; category?: string; tag?: string; sort?: string; page?: number }) => {
    const p = new URLSearchParams();
    const nq = (overrides.q ?? q).trim();
    const nc = (overrides.category ?? category).trim();
    const nt = (overrides.tag ?? tag).trim();
    const ns = overrides.sort ?? sort;
    const np = overrides.page ?? 1;
    if (nq) p.set("q", nq);
    if (nc) p.set("category", nc);
    if (nt) p.set("tag", nt);
    if (ns !== "recent") p.set("sort", ns);
    if (np > 1) p.set("page", String(np));
    const s = p.toString();
    return `/blog${s ? `?${s}` : ""}`;
  };

  return (
    <div className="relative min-h-screen">
      {/* Ambient Effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-orb rv-animate-pulse-glow" style={{ width: "600px", height: "600px", top: "-10%", right: "-5%", background: "var(--rv-accent)", opacity: 0.15 }} />
        <div className="rv-orb" style={{ width: "400px", height: "400px", bottom: "5%", left: "-10%", background: "var(--rv-cyan)", opacity: 0.12 }} />
      </div>

      {/* Hero */}
      <section className="relative border-b border-[var(--rv-border)] bg-gradient-to-b from-[var(--rv-surface)]/80 to-transparent">
        <div className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpath d='M28 66L0 50V18L28 2l28 16v32L28 66zm0-2l26-15V19L28 4 2 19v30l26 15z' fill='none' stroke='%238b5cf6' stroke-width='1'/%3E%3C/svg%3E")` }}
        />
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:py-24 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
            <div className="space-y-4">
              <span className="rv-badge rv-badge-purple inline-flex">✦ Crônicas de Raven</span>
              <h1 className="rv-display text-5xl sm:text-6xl md:text-7xl text-[var(--rv-text-primary)] tracking-tight">Blog & Novidades</h1>
              <p className="mt-4 text-[var(--rv-text-muted)] max-w-lg text-sm sm:text-base leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
                Patch notes, histórias do mundo, guias e atualizações direto da equipe Raven.
              </p>
            </div>
            <div className="flex-shrink-0">
              <BlogHeaderActions />
            </div>
          </div>

          {/* Stats */}
          <div className="mt-12 flex flex-wrap gap-4">
            {[
              { val: postsRes.ok ? String(postsRes.data.count) : "—", label: "Artigos" },
              { val: String(categories.length), label: "Categorias" },
              { val: String(tags.length), label: "Tags" },
            ].map((s) => (
              <div key={s.label} className="rv-card px-6 py-4 flex flex-col items-center min-w-[100px] bg-white/5 backdrop-blur-sm border-white/10">
                <div className="rv-display text-xl sm:text-2xl text-[var(--rv-accent)]">{s.val}</div>
                <div className="rv-label text-[8px] sm:text-[9px] uppercase tracking-widest text-[var(--rv-text-dim)] mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Grid Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:py-16 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-8 space-y-10">
          
          <BlogSearchBar defaultValue={q} categories={categories} />

          {!postsRes.ok ? (
            <div className="rv-card p-12 text-center text-[var(--rv-text-muted)]">Nenhum artigo disponível no momento.</div>
          ) : (postsRes.data?.results || []).length === 0 ? (
            <div className="rv-card p-20 text-center bg-white/5 border-dashed">
              <div className="text-4xl mb-4 opacity-20">📜</div>
              <h3 className="rv-display text-xl text-[var(--rv-text-primary)] mb-2">Sem resultados</h3>
              <p className="text-[var(--rv-text-muted)] text-sm">Tente outros termos ou limpe os filtros.</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {(postsRes.data?.results || []).map((p, idx) => (
                <article key={p.id} className="rv-card group flex flex-col hover:scale-[1.02] transition-all duration-300">
                  <Link href={`/blog/${p.slug}`} className="relative h-36 sm:h-44 overflow-hidden rounded-t-2xl border-b border-white/5">
                    {p.image ? (
                      <Image src={fixImageUrl(p.image) ?? ""} alt={p.title} fill unoptimized priority={idx === 0} className="object-cover group-hover:scale-110 transition-transform duration-700" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[var(--rv-surface-2)] to-[var(--rv-surface)] flex items-center justify-center">
                        <span className="text-4xl opacity-10">◈</span>
                      </div>
                    )}
                    <div className="absolute top-4 left-4">
                      <span className="rv-badge rv-badge-purple text-[8px]">{p.category_name}</span>
                    </div>
                  </Link>
                  <div className="p-4 sm:p-6 flex flex-col flex-1 gap-4">
                    <div className="flex items-center justify-between rv-label text-[8px] text-[var(--rv-text-dim)]">
                      <span>{p.published_at ? new Date(p.published_at).toLocaleDateString() : "Rascunho"}</span>
                      <span>{p.read_time_minutes} min leitura</span>
                    </div>
                    <Link href={`/blog/${p.slug}`}>
                      <h3 className="rv-display text-lg text-[var(--rv-text-primary)] group-hover:text-[var(--rv-accent)] transition-colors line-clamp-2">{p.title}</h3>
                    </Link>
                    <p className="text-xs text-[var(--rv-text-muted)] line-clamp-3 leading-relaxed flex-1">{p.excerpt}</p>
                    <div className="rv-divider" />
                    <div className="flex items-center justify-between">
                      <span className="rv-label text-[8px] text-[var(--rv-text-dim)]">por {p.author_name}</span>
                      <Link href={`/blog/${p.slug}`} className="text-[10px] text-[var(--rv-accent)] flex items-center gap-1 group-hover:gap-2 transition-all">Ler Artigo →</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {postsRes.ok && (canPrev || canNext) && (
            <div className="flex items-center justify-between pt-8">
              <Link href={buildHref({ page: page - 1 })} className={`rv-btn rv-btn-ghost h-10 px-6 text-xs ${!canPrev ? "pointer-events-none opacity-20" : ""}`}>← Anterior</Link>
              <span className="rv-label text-[10px] text-[var(--rv-text-dim)]">Página {page}</span>
              <Link href={buildHref({ page: page + 1 })} className={`rv-btn rv-btn-ghost h-10 px-6 text-xs ${!canNext ? "pointer-events-none opacity-20" : ""}`}>Próxima →</Link>
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <BlogSidebarTaxonomy
            initialCategories={categories}
            initialTags={tags}
          />
        </aside>
      </div>

      <BlogAdminPanel />
    </div>
  );
}
