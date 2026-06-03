import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { HeroCta } from "@/components/hero-cta";
import { JsonLd } from "@/components/json-ld";
import { getSiteBaseUrl } from "@/lib/env";
import { backendFetch } from "@/lib/backend";
import { fixImageUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Projeto Raven — Blog & Fórum",
  description: "Seu espaço central para explorar artigos técnicos, participar de fóruns de discussão e interagir com uma comunidade apaixonada por tecnologia.",
  openGraph: {
    title: "Projeto Raven — Blog & Fórum",
    description: "Artigos, fórum e comunidade.",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "Projeto Raven — Blog & Fórum",
    description: "Artigos, fórum e comunidade.",
  },
};

type BlogPostListItem = {
  id: string; title: string; slug: string; excerpt: string | null;
  author_name: string; category_name: string;
  published_at: string | null; created_at: string;
  read_time_minutes: number; image: string | null;
  view_count?: number;
};

type TopicListItem = {
  id: string; title: string; slug: string;
  author: { username: string; display_name?: string };
  category_name: string; reply_count: number; view_count: number;
  last_reply_at: string | null;
};

type CategoryListItem = { id: string; name: string; slug: string; post_count?: number };
type TagListItem = { id: string; name: string; slug: string };

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

type HealthDetailed = {
  stats?: {
    total_users?: number;
  };
};

function extractList<T>(data: unknown): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results as T[];
  }
  return [];
}

const features = [
  {
    icon: "✦",
    badge: "Blog",
    badgeClass: "rv-badge-purple",
    title: "Blog",
    description: "Artigos, atualizações e conteúdo curado pela nossa equipe.",
    href: "/blog",
  },
  {
    icon: "◈",
    badge: "Community",
    badgeClass: "rv-badge-cyan",
    title: "Fórum",
    description: "Discussões, suporte e interação constante entre os membros.",
    href: "/forum",
  },
  {
    icon: "🛡️",
    badge: "Profile",
    badgeClass: "rv-badge-gold",
    title: "Sua Conta",
    description: "Gerencie seu perfil, configurações e seu histórico de atividades.",
    href: "/me",
  },
  {
    icon: "📷",
    badge: "Uploads",
    badgeClass: "rv-badge-red",
    title: "Mídia",
    description: "Faça upload e gerencie suas imagens, arquivos e avatares facilmente.",
    href: "/me",
  },
];

export default async function Home() {
  const base = getSiteBaseUrl();

  const [postsRes, topicsRes, popularRes, categoriesRes, tagsRes, healthRes] = await Promise.allSettled([
    backendFetch<Paginated<BlogPostListItem>>(
      "/api/v1/blog/public/posts/?page=1&page_size=3&ordering=-published_at",
      { method: "GET", next: { revalidate: 120 } }
    ),
    backendFetch<Paginated<TopicListItem>>(
      "/api/v1/forum/public/topics/?page=1&page_size=5&ordering=-last_reply_at",
      { method: "GET", next: { revalidate: 60 } }
    ),
    backendFetch<Paginated<BlogPostListItem>>(
      "/api/v1/blog/public/posts/?page=1&page_size=3&ordering=-view_count",
      { method: "GET", next: { revalidate: 300 } }
    ),
    backendFetch<unknown>("/api/v1/blog/public/categories/?page=1&page_size=12", { method: "GET", next: { revalidate: 300 } }),
    backendFetch<unknown>("/api/v1/blog/public/tags/?page=1&page_size=18", { method: "GET", next: { revalidate: 300 } }),
    backendFetch<HealthDetailed>("/api/health/detailed/", { method: "GET", next: { revalidate: 60 } }),
  ]);

  const posts: BlogPostListItem[] =
    postsRes.status === "fulfilled" && postsRes.value.ok
      ? extractList(postsRes.value.data)
      : [];

  const topics: TopicListItem[] =
    topicsRes.status === "fulfilled" && topicsRes.value.ok
      ? extractList(topicsRes.value.data)
      : [];

  const popularPosts: BlogPostListItem[] =
    popularRes.status === "fulfilled" && popularRes.value.ok
      ? extractList(popularRes.value.data)
      : [];

  const categories: CategoryListItem[] =
    categoriesRes.status === "fulfilled" && categoriesRes.value.ok
      ? extractList<CategoryListItem>(categoriesRes.value.data)
      : [];

  const tags: TagListItem[] =
    tagsRes.status === "fulfilled" && tagsRes.value.ok
      ? extractList<TagListItem>(tagsRes.value.data)
      : [];

  const totalArticles =
    postsRes.status === "fulfilled" && postsRes.value.ok ? postsRes.value.data.count : null;
  const totalTopics =
    topicsRes.status === "fulfilled" && topicsRes.value.ok ? topicsRes.value.data.count : null;
  const totalMembers =
    healthRes.status === "fulfilled" && healthRes.value.ok
      ? (healthRes.value.data.stats?.total_users ?? null)
      : null;

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Projeto Raven",
    url: base,
    description: "Blog, fórum e comunidade.",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${base}/blog?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Projeto Raven",
    url: base,
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <JsonLd data={websiteSchema} />
      <JsonLd data={orgSchema} />
      {/* ── Ambient background orbs ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-orb rv-animate-pulse-glow w-[600px] h-[600px] top-[-10%] left-[-15%] bg-[var(--rv-accent)]" />
        <div className="rv-orb rv-animate-pulse-glow w-[400px] h-[400px] bottom-[-5%] right-[-10%] bg-[var(--rv-cyan)] [animation-delay:1.5s]" />
        <div className="rv-orb w-[300px] h-[300px] top-[40%] right-[20%] bg-[var(--rv-accent-2)] opacity-20" />
      </div>

      {/* ── Hero Section ── */}
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-center px-4 text-center">
        <div className="pointer-events-none absolute inset-0 opacity-5 rv-hero-grid" />

        <div className="relative z-10 max-w-5xl px-4 sm:px-6">
          <div className="mb-6 sm:mb-8 inline-flex">
            <span className="rv-badge rv-badge-purple">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--rv-accent)] animate-pulse" />
              Plataforma Online
            </span>
          </div>

          <h1 className="rv-display text-[clamp(3rem,12vw,10rem)] text-[var(--rv-text-primary)] mb-4 sm:mb-6">
            PROJETO<br />
            <span className="rv-text-gradient">RAVEN</span>
          </h1>

          <p className="text-[var(--rv-text-muted)] text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-3 sm:mb-4 px-2 font-[var(--font-body)]">
            Seu espaço central para explorar artigos técnicos, participar de fóruns de discussão e interagir com uma comunidade apaixonada por tecnologia.
          </p>
          <p className="rv-label text-[var(--rv-accent)] mb-10 sm:mb-14 tracking-[0.3em] sm:tracking-[0.5em] text-[8px] sm:text-[10px]">
            ✦ CONHECIMENTO · CONEXÃO · COMUNIDADE ✦
          </p>

          <HeroCta />
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <span className="rv-label text-[9px] tracking-[0.4em]">Explorar</span>
          <div className="h-12 w-6 rounded-full border border-white/20 flex items-start justify-center p-1.5">
            <div className="h-2 w-1 rounded-full bg-[var(--rv-accent)] rv-animate-float" />
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="relative z-10 border-y border-[var(--rv-border)] bg-[var(--rv-surface)]/50 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--rv-border)]">
          {[
            { val: totalArticles == null ? "—" : totalArticles.toLocaleString("pt-BR"), label: "Artigos" },
            { val: totalTopics == null ? "—" : totalTopics.toLocaleString("pt-BR"), label: "Tópicos" },
            { val: totalMembers == null ? "—" : totalMembers.toLocaleString("pt-BR"), label: "Membros" },
            { val: "JWT",  label: "Auth API" },
          ].map((s) => (
            <div key={s.label} className="py-5 px-4 sm:py-6 sm:px-8 text-center">
              <div className="rv-display text-lg sm:text-2xl text-[var(--rv-accent)]">{s.val}</div>
              <div className="rv-label text-[8px] sm:text-[9px] text-[var(--rv-text-dim)] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comece por aqui ── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:py-20 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <span className="rv-badge rv-badge-gold mb-4 inline-flex">✦ Comece por aqui</span>
          <h2 className="rv-display text-2xl sm:text-3xl text-[var(--rv-text-primary)]">Três caminhos rápidos</h2>
          <p className="text-sm text-[var(--rv-text-muted)] mt-3 font-[var(--font-body)]">
            Encontre conteúdo, leia artigos e participe de discussões — sem fricção.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {[
            { title: "Buscar", desc: "Pesquise em artigos e tópicos.", href: "/search", badge: "Busca", badgeClass: "rv-badge-cyan", icon: "🔎" },
            { title: "Explorar blog", desc: "Leia os últimos artigos e séries.", href: "/blog", badge: "Blog", badgeClass: "rv-badge-purple", icon: "✦" },
            { title: "Ir ao fórum", desc: "Crie tópicos e interaja com a comunidade.", href: "/forum", badge: "Fórum", badgeClass: "rv-badge-cyan", icon: "◈" },
          ].map((c) => (
            <Link key={c.title} href={c.href} className="rv-card group p-7 flex flex-col gap-3 hover:scale-[1.01] transition-transform duration-200">
              <div className="flex items-start justify-between">
                <div className="h-12 w-12 rounded-2xl bg-[var(--rv-surface-2)] border border-[var(--rv-border)] flex items-center justify-center text-xl">
                  {c.icon}
                </div>
                <span className={`rv-badge ${c.badgeClass}`}>{c.badge}</span>
              </div>
              <div>
                <h3 className="rv-display text-lg text-[var(--rv-text-primary)]">{c.title}</h3>
                <p className="text-sm text-[var(--rv-text-muted)] leading-relaxed font-[var(--font-body)] mt-1">
                  {c.desc}
                </p>
              </div>
              <div className="mt-auto flex items-center gap-2 text-[var(--rv-accent)] rv-label text-[10px]">
                Abrir <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:py-28 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <span className="rv-badge rv-badge-cyan mb-4 sm:mb-6 inline-flex">✦ Funcionalidades</span>
          <h2 className="rv-display text-3xl sm:text-4xl md:text-5xl text-[var(--rv-text-primary)]">
            O Ecossistema Completo
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2">
          {features.map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="rv-card group p-8 flex flex-col gap-4 hover:scale-[1.01] transition-transform duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="h-14 w-14 rounded-2xl bg-[var(--rv-surface-2)] border border-[var(--rv-border)] flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <span className={`rv-badge ${f.badgeClass}`}>{f.badge}</span>
              </div>
              <div>
                <h3 className="rv-display text-xl text-[var(--rv-text-primary)] mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--rv-text-muted)] leading-relaxed font-[var(--font-body)]">
                  {f.description}
                </p>
              </div>
              <div className="mt-auto flex items-center gap-2 text-[var(--rv-accent)] rv-label text-[10px]">
                Explorar <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Latest articles ── */}
      {posts.length > 0 && (
        <section className="relative z-10 mx-auto max-w-7xl px-4 pb-16 sm:pb-24 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8 sm:mb-12">
            <div>
              <span className="rv-badge rv-badge-purple mb-3 inline-flex">✦ Blog</span>
              <h2 className="rv-display text-2xl sm:text-3xl text-[var(--rv-text-primary)]">Últimos Artigos</h2>
            </div>
            <Link href="/blog" className="rv-btn rv-btn-ghost text-xs px-5 h-9">
              Ver todos →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map((post) => {
              const imgSrc = post.image ? fixImageUrl(post.image) : null;
              return (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="rv-card group flex flex-col overflow-hidden hover:scale-[1.01] transition-transform duration-200"
                >
                  {imgSrc ? (
                    <div className="relative h-40 w-full overflow-hidden">
                      <Image src={imgSrc} alt={post.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                    </div>
                  ) : (
                    <div className="h-40 w-full bg-gradient-to-br from-[var(--rv-surface-2)] to-[var(--rv-surface)] flex items-center justify-center text-4xl opacity-30">✦</div>
                  )}
                  <div className="flex flex-col gap-2 p-5 flex-1">
                    {post.category_name && (
                      <span className="rv-badge rv-badge-purple text-[8px]">{post.category_name}</span>
                    )}
                    <h3 className="rv-display text-base text-[var(--rv-text-primary)] line-clamp-2 group-hover:text-[var(--rv-accent)] transition-colors">
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="text-xs text-[var(--rv-text-muted)] line-clamp-2 leading-relaxed font-[var(--font-body)]">
                        {post.excerpt}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between pt-3 border-t border-[var(--rv-border)]">
                      <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">{post.author_name}</span>
                      <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">{post.read_time_minutes} min</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Featured / popular ── */}
      {popularPosts.length > 0 && (
        <section className="relative z-10 mx-auto max-w-7xl px-4 pb-16 sm:pb-24 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8 sm:mb-12">
            <div>
              <span className="rv-badge rv-badge-gold mb-3 inline-flex">⭐ Destaques</span>
              <h2 className="rv-display text-2xl sm:text-3xl text-[var(--rv-text-primary)]">Mais lidos</h2>
            </div>
            <Link href="/blog?sort=popular" className="rv-btn rv-btn-ghost text-xs px-5 h-9">
              Ver ranking →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {popularPosts.map((post) => {
              const imgSrc = post.image ? fixImageUrl(post.image) : null;
              return (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="rv-card group flex flex-col overflow-hidden hover:scale-[1.01] transition-transform duration-200"
                >
                  {imgSrc ? (
                    <div className="relative w-full overflow-hidden aspect-video">
                      <Image
                        src={imgSrc}
                        alt={post.title}
                        fill
                        className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-video bg-gradient-to-br from-[var(--rv-surface-2)] to-[var(--rv-surface)] flex items-center justify-center text-4xl opacity-30">
                      ⭐
                    </div>
                  )}
                  <div className="flex flex-col gap-2 p-5 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      {post.category_name ? (
                        <span className="rv-badge rv-badge-purple text-[8px]">{post.category_name}</span>
                      ) : (
                        <span />
                      )}
                      {typeof post.view_count === "number" ? (
                        <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">
                          {post.view_count.toLocaleString("pt-BR")} views
                        </span>
                      ) : null}
                    </div>
                    <h3 className="rv-display text-base text-[var(--rv-text-primary)] line-clamp-2 group-hover:text-[var(--rv-accent)] transition-colors">
                      {post.title}
                    </h3>
                    {post.excerpt ? (
                      <p className="text-xs text-[var(--rv-text-muted)] line-clamp-2 leading-relaxed font-[var(--font-body)]">
                        {post.excerpt}
                      </p>
                    ) : null}
                    <div className="mt-auto flex items-center justify-between pt-3 border-t border-[var(--rv-border)]">
                      <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">{post.author_name}</span>
                      <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">{post.read_time_minutes} min</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Explorar por tema ── */}
      {(categories.length > 0 || tags.length > 0) && (
        <section className="relative z-10 mx-auto max-w-7xl px-4 pb-16 sm:pb-24 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 sm:mb-12">
            <div>
              <span className="rv-badge rv-badge-purple mb-3 inline-flex">✦ Descoberta</span>
              <h2 className="rv-display text-2xl sm:text-3xl text-[var(--rv-text-primary)]">Explorar por tema</h2>
              <p className="text-sm text-[var(--rv-text-muted)] mt-2 font-[var(--font-body)]">
                Categorias e tags para navegar mais rápido pelo conteúdo.
              </p>
            </div>
            <Link href="/blog" className="rv-btn rv-btn-ghost text-xs px-5 h-9 self-start sm:self-auto">
              Ver blog →
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            <div className="rv-card p-6 sm:p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="rv-display text-lg text-[var(--rv-text-primary)]">Categorias</h3>
                <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">{categories.length}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.slice(0, 12).map((c) => (
                  <Link
                    key={c.id}
                    href={`/blog?category=${encodeURIComponent(c.slug)}`}
                    className="rv-badge rv-badge-purple text-[8px] hover:opacity-90 transition-opacity"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="rv-card p-6 sm:p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="rv-display text-lg text-[var(--rv-text-primary)]">Tags</h3>
                <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">{tags.length}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.slice(0, 18).map((t) => (
                  <Link
                    key={t.id}
                    href={`/blog?tag=${encodeURIComponent(t.slug)}`}
                    className="rv-badge rv-badge-cyan text-[8px] hover:opacity-90 transition-opacity"
                  >
                    {t.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Active topics ── */}
      {topics.length > 0 && (
        <section className="relative z-10 mx-auto max-w-7xl px-4 pb-16 sm:pb-24 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8 sm:mb-12">
            <div>
              <span className="rv-badge rv-badge-cyan mb-3 inline-flex">◈ Fórum</span>
              <h2 className="rv-display text-2xl sm:text-3xl text-[var(--rv-text-primary)]">Tópicos Ativos</h2>
            </div>
            <Link href="/forum" className="rv-btn rv-btn-ghost text-xs px-5 h-9">
              Ver todos →
            </Link>
          </div>

          <div className="space-y-3">
            {topics.map((topic) => (
              <Link
                key={topic.id}
                href={`/forum/t/${topic.slug}`}
                className="rv-card group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-3 hover:scale-[1.005] transition-all duration-200"
              >
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <span className="rv-badge rv-badge-cyan text-[8px] self-start">{topic.category_name}</span>
                  <h3 className="rv-display text-sm sm:text-base text-[var(--rv-text-primary)] group-hover:text-[var(--rv-accent)] transition-colors line-clamp-1">
                    {topic.title}
                  </h3>
                  <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">
                    por {topic.author?.display_name || topic.author?.username || "Desconhecido"}
                  </span>
                </div>
                <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
                  <div className="text-center">
                    <div className="rv-display text-sm text-[var(--rv-text-primary)]">{topic.reply_count}</div>
                    <div className="rv-label text-[8px] text-[var(--rv-text-dim)]">Resp.</div>
                  </div>
                  <div className="text-center">
                    <div className="rv-display text-sm text-[var(--rv-text-primary)]">{topic.view_count}</div>
                    <div className="rv-label text-[8px] text-[var(--rv-text-dim)]">Views</div>
                  </div>
                  <span className="text-[var(--rv-accent)] group-hover:translate-x-1 transition-transform inline-block text-sm">→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── CTA Footer ── */}
      <section className="relative z-10 border-t border-[var(--rv-border)] bg-[var(--rv-surface)]/30">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <span className="rv-badge rv-badge-gold mb-8 inline-flex">🤝 Conecte-se conosco</span>
          <h2 className="rv-display text-4xl md:text-6xl text-[var(--rv-text-primary)] mb-6">
            Continue explorando<br />
            <span className="rv-text-accent">o Projeto Raven.</span>
          </h2>
          <p className="text-[var(--rv-text-muted)] mb-10 text-lg font-[var(--font-body)]">
            Leia o blog, participe do fórum e acompanhe os destaques. Quando quiser, entre para comentar e publicar.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/blog" className="rv-btn rv-btn-primary px-12 h-14">
              Explorar Blog
            </Link>
            <Link href="/forum" className="rv-btn rv-btn-ghost px-10 h-14">
              Ir ao Fórum
            </Link>
            <Link href="/register" className="rv-btn rv-btn-ghost px-10 h-14">
              Criar Conta
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
