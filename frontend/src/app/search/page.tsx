"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, FileText, MessageSquare, Clock, ChevronRight, Loader2 } from "lucide-react";
import { fixImageUrl } from "@/lib/utils";

type PostResult = {
  type: "post";
  slug: string;
  title: string;
  excerpt: string;
  published_at: string | null;
  image: string | null;
  author: string;
  url: string;
};

type TopicResult = {
  type: "topic";
  slug: string;
  title: string;
  created_at: string;
  reply_count: number;
  category_name: string;
  category_slug: string;
  author: string;
  url: string;
};

type SearchData = {
  query: string;
  posts: PostResult[];
  topics: TopicResult[];
};

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const initialQ = params.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [data, setData] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!initialQ.trim()) return;
    void doSearch(initialQ);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function doSearch(q: string) {
    if (q.trim().length < 2) { setData(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=10`);
      const json = await res.json() as SearchData;
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const url = v.trim() ? `/search?q=${encodeURIComponent(v.trim())}` : "/search";
      router.replace(url, { scroll: false });
      void doSearch(v.trim());
    }, 350);
  }

  const hasResults = data && (data.posts.length > 0 || data.topics.length > 0);
  const searched = !!data;
  const total = (data?.posts.length ?? 0) + (data?.topics.length ?? 0);

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-orb rv-animate-pulse-glow" style={{ width: "500px", height: "500px", top: "-10%", left: "-5%", background: "var(--rv-accent)", opacity: 0.12 }} />
        <div className="rv-orb" style={{ width: "350px", height: "350px", bottom: "5%", right: "-5%", background: "var(--rv-cyan)", opacity: 0.08 }} />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-12 sm:py-16 sm:px-6">
        {/* Header */}
        <div className="mb-10 space-y-3">
          <span className="rv-badge rv-badge-purple inline-flex">✦ Busca Global</span>
          <h1 className="rv-display text-4xl sm:text-5xl text-[var(--rv-text-primary)]">Buscar</h1>
          <p className="text-[var(--rv-text-muted)] text-sm" style={{ fontFamily: "var(--font-body)" }}>
            Encontre artigos do blog e tópicos do fórum em um só lugar.
          </p>
        </div>

        {/* Search input */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--rv-text-dim)]" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={handleChange}
            placeholder="Buscar artigos, tópicos..."
            autoFocus
            className="rv-input pl-12 pr-4 h-14 text-base w-full rounded-2xl"
            aria-label="Busca global"
          />
          {loading && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[var(--rv-accent)]" aria-hidden />
          )}
        </div>

        {/* Status */}
        {searched && !loading && (
          <p className="text-xs text-[var(--rv-text-dim)] mb-6 rv-label tracking-wider">
            {hasResults
              ? `${total} resultado${total !== 1 ? "s" : ""} para "${data.query}"`
              : `Nenhum resultado para "${data?.query}"`}
          </p>
        )}

        {/* Empty state */}
        {!query.trim() && (
          <div className="text-center py-20">
            <Search className="h-12 w-12 text-[var(--rv-text-dim)] mx-auto mb-4" aria-hidden />
            <p className="text-[var(--rv-text-muted)] text-sm" style={{ fontFamily: "var(--font-body)" }}>
              Digite para buscar em blog e fórum
            </p>
          </div>
        )}

        {/* No results */}
        {searched && !loading && !hasResults && query.trim() && (
          <div className="text-center py-20">
            <p className="text-[var(--rv-text-muted)] text-sm mb-6" style={{ fontFamily: "var(--font-body)" }}>
              Tente termos diferentes ou explore o conteúdo abaixo.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/blog" className="rv-btn rv-btn-ghost px-6 h-10 text-xs">Ver Blog</Link>
              <Link href="/forum" className="rv-btn rv-btn-primary px-6 h-10 text-xs">Ver Fórum</Link>
            </div>
          </div>
        )}

        {/* Results */}
        {hasResults && (
          <div className="space-y-10">
            {/* Blog posts */}
            {data.posts.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-4 w-4 text-[var(--rv-accent)]" aria-hidden />
                  <h2 className="rv-display text-sm text-[var(--rv-text-primary)]">
                    Artigos do Blog
                    <span className="ml-2 text-[var(--rv-text-dim)] font-normal">({data.posts.length})</span>
                  </h2>
                </div>
                <div className="space-y-3">
                  {data.posts.map((p) => (
                    <Link
                      key={p.slug}
                      href={p.url}
                      className="rv-card p-5 flex gap-4 hover:border-[var(--rv-accent)]/40 hover:bg-[var(--rv-surface-2)] transition-all group"
                    >
                      {p.image && (
                        <Image
                          src={fixImageUrl(p.image) ?? ""}
                          alt=""
                          width={80}
                          height={64}
                          className="h-16 w-20 rounded-xl object-cover flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="rv-display text-base text-[var(--rv-text-primary)] truncate group-hover:text-[var(--rv-accent)] transition-colors">
                          {p.title}
                        </h3>
                        {p.excerpt && (
                          <p className="text-xs text-[var(--rv-text-muted)] line-clamp-2 mt-1" style={{ fontFamily: "var(--font-body)" }}>
                            {p.excerpt}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--rv-text-dim)] rv-label tracking-wide">
                          {p.author && <span>{p.author}</span>}
                          {p.published_at && (
                            <span className="flex items-center gap-1" suppressHydrationWarning>
                              <Clock className="h-3 w-3" aria-hidden /> {formatDate(p.published_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[var(--rv-text-dim)] flex-shrink-0 self-center group-hover:text-[var(--rv-accent)] transition-colors" aria-hidden />
                    </Link>
                  ))}
                </div>
                <div className="mt-3 text-right">
                  <Link href={`/blog?q=${encodeURIComponent(data.query)}`} className="text-xs text-[var(--rv-accent)] hover:underline rv-label">
                    Ver todos no Blog →
                  </Link>
                </div>
              </section>
            )}

            {/* Forum topics */}
            {data.topics.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="h-4 w-4 text-[var(--rv-cyan)]" aria-hidden />
                  <h2 className="rv-display text-sm text-[var(--rv-text-primary)]">
                    Tópicos do Fórum
                    <span className="ml-2 text-[var(--rv-text-dim)] font-normal">({data.topics.length})</span>
                  </h2>
                </div>
                <div className="space-y-3">
                  {data.topics.map((t) => (
                    <div
                      key={t.slug}
                      role="link"
                      tabIndex={0}
                      onClick={() => router.push(t.url)}
                      onKeyDown={(e) => e.key === "Enter" && router.push(t.url)}
                      className="rv-card p-5 flex items-center gap-4 hover:border-[var(--rv-cyan)]/40 hover:bg-[var(--rv-surface-2)] transition-all group cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="rv-display text-base text-[var(--rv-text-primary)] truncate group-hover:text-[var(--rv-cyan)] transition-colors">
                          {t.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--rv-text-dim)] rv-label tracking-wide flex-wrap">
                          <Link
                            href={`/forum/c/${t.category_slug}`}
                            onClick={(e) => e.stopPropagation()}
                            className="rv-badge rv-badge-cyan text-[9px] hover:opacity-80 transition-opacity"
                          >
                            {t.category_name}
                          </Link>
                          {t.author && <span>{t.author}</span>}
                          <span className="flex items-center gap-1" suppressHydrationWarning>
                            <Clock className="h-3 w-3" aria-hidden /> {formatDate(t.created_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" aria-hidden /> {t.reply_count}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[var(--rv-text-dim)] flex-shrink-0 group-hover:text-[var(--rv-cyan)] transition-colors" aria-hidden />
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-right">
                  <Link href={`/forum?q=${encodeURIComponent(data.query)}`} className="text-xs text-[var(--rv-cyan)] hover:underline rv-label">
                    Ver todos no Fórum →
                  </Link>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--rv-accent)]" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
