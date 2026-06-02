import Link from "next/link";
import type { Metadata } from "next";
import { backendFetch } from "@/lib/backend";
import { ForumHeaderActions } from "@/app/forum/forum-header-actions";
import { ForumSidebar } from "@/app/forum/forum-sidebar";
import { RecentTopicsList } from "./recent-topics-list";
import { ForumTopicSearch } from "@/features/forum/components/forum-topic-search";

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };
type ForumCategory = {
  id: string; name: string; slug: string; description: string;
  icon: string | null; topic_count: number; reply_count: number;
};

export const metadata: Metadata = {
  title: "Fórum | RAVEN",
  description: "Discussões, dúvidas e novidades da comunidade Raven.",
  alternates: { canonical: "/forum" },
};

export default async function ForumPage() {
  const categoriesRes = await backendFetch<Paginated<ForumCategory>>(
    "/api/v1/forum/public/categories/?page=1&page_size=50",
    { method: "GET", next: { revalidate: 300 } }
  );
  const categories = categoriesRes.ok ? categoriesRes.data.results : [];
  const totalTopics = categories.reduce((s, c) => s + c.topic_count, 0);
  const totalReplies = categories.reduce((s, c) => s + c.reply_count, 0);

  return (
    <div className="relative min-h-screen">
      {/* Ambient Effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-orb rv-animate-pulse-glow w-[600px] h-[600px] top-[-10%] right-[-5%] bg-[var(--rv-accent)] opacity-15" />
        <div className="rv-orb w-[400px] h-[400px] bottom-[5%] left-[-10%] bg-[var(--rv-cyan)] opacity-10" />
      </div>

      {/* Hero */}
      <section className="relative border-b border-[var(--rv-border)] bg-gradient-to-b from-[var(--rv-surface)]/80 to-transparent">
        <div className="pointer-events-none absolute inset-0 opacity-[0.05] rv-hero-grid" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:py-24 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
            <div className="space-y-4">
              <span className="rv-badge rv-badge-cyan inline-flex">◈ Comunidade</span>
              <h1 className="rv-display text-5xl sm:text-6xl md:text-7xl text-[var(--rv-text-primary)] tracking-tight">
                Fórum & Discussões
              </h1>
              <p className="mt-4 text-[var(--rv-text-muted)] max-w-lg text-sm sm:text-base leading-relaxed font-[var(--font-body)]">
                Discussões, dúvidas e novidades direto da comunidade.
              </p>
            </div>
            <div className="flex-shrink-0">
              <ForumHeaderActions newTopicHref="/forum/new" />
            </div>
          </div>

          {/* Stats */}
          <div className="mt-12 flex flex-wrap gap-4">
            {[
              { val: String(categories.length), label: "Categorias" },
              { val: totalTopics > 0 ? String(totalTopics) : "—", label: "Tópicos" },
              { val: totalReplies > 0 ? String(totalReplies) : "—", label: "Respostas" },
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
          <ForumTopicSearch />

          <RecentTopicsList />

          {/* Category grid */}
          {categories.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="rv-badge rv-badge-purple">◆ Categorias</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/forum/c/${c.slug}`}
                    className="rv-card group p-5 sm:p-6 flex flex-col gap-3 hover:scale-[1.02] transition-all duration-300"
                  >
                    <div className="flex items-start justify-between">
                      <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-[var(--rv-surface-2)] border border-[var(--rv-border)] flex items-center justify-center text-lg sm:text-xl group-hover:scale-110 transition-transform flex-shrink-0">
                        {c.icon || "◈"}
                      </div>
                      <span className="rv-badge rv-badge-purple text-[8px]">{c.topic_count} tópicos</span>
                    </div>
                    <div>
                      <h3 className="rv-display text-base sm:text-lg text-[var(--rv-text-primary)] group-hover:text-[var(--rv-accent)] transition-colors">
                        {c.name}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--rv-text-muted)] line-clamp-2 font-[var(--font-body)]">
                        {c.description}
                      </p>
                    </div>
                    <div className="rv-divider" />
                    <div className="flex items-center justify-between rv-label text-[8px] sm:text-[9px] text-[var(--rv-text-dim)]">
                      <span>{c.reply_count} respostas</span>
                      <span className="text-[var(--rv-accent)] group-hover:translate-x-1 transition-transform inline-block">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {!categoriesRes.ok && (
            <div className="rv-card p-8 text-center space-y-2">
              <p className="text-[var(--rv-text-muted)] font-[var(--font-body)]">
                Não foi possível carregar as categorias do fórum.
              </p>
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <ForumSidebar categories={categories} />
        </aside>

      </div>
    </div>
  );
}
