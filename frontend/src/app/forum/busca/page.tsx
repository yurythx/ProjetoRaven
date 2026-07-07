"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { Search, MessageSquare, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type TopicResult = {
  id: string;
  title: string;
  slug: string;
  category: { name: string; slug: string } | null;
  reply_count: number;
  view_count?: number;
  created_at?: string;
  author_name?: string;
};

type PaginatedTopics = { count: number; next: string | null; results: TopicResult[] };

async function fetchTopics(q: string, page: number): Promise<PaginatedTopics> {
  const params = new URLSearchParams({ q, page: String(page), page_size: "20" });
  const res = await fetch(`/api/forum/topics?${params}`);
  if (!res.ok) {
    throw new Error("Falha ao carregar resultados do fórum.");
  }
  const body = await res.json() as PaginatedTopics | TopicResult[];
  if (Array.isArray(body)) return { count: body.length, next: null, results: body };
  return body;
}

export default function ForumBuscaPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get("q") ?? "";

  const [inputValue, setInputValue] = useState(initialQ);
  const debouncedInput = useDebounce(inputValue, 400);
  const [page, setPage] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedInput]);

  useEffect(() => {
    setInputValue(initialQ);
  }, [initialQ]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const query = debouncedInput.trim();

  useEffect(() => {
    if (query === initialQ.trim()) return;
    const params = new URLSearchParams(searchParams.toString());
    if (query) {
      params.set("q", query);
    } else {
      params.delete("q");
    }
    params.delete("page");
    const qs = params.toString();
    router.replace(`/forum/busca${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [initialQ, query, router, searchParams]);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["forum-busca", query, page],
    queryFn: () => fetchTopics(query, page),
    enabled: query.length >= 2,
    staleTime: 15_000,
  });

  const totalPages = data ? Math.ceil(data.count / 20) : 0;

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-orb rv-animate-pulse-glow w-[500px] h-[500px] top-[-10%] right-[-5%] bg-[var(--rv-accent)] opacity-15" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        {/* Nav */}
        <nav className="flex items-center gap-2 mb-8 rv-label text-[9px] text-[var(--rv-text-dim)]">
          <button onClick={() => router.push("/forum")} className="hover:text-[var(--rv-accent)] transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Fórum
          </button>
          <span>›</span>
          <span className="text-[var(--rv-text-muted)]">Busca</span>
        </nav>

        {/* Search bar */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--rv-text-dim)]" />
          <input
            ref={inputRef}
            type="search"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Buscar tópicos no fórum..."
            className="w-full h-14 rounded-xl border border-[var(--rv-border)] bg-[var(--rv-surface)] pl-12 pr-4 text-base text-[var(--rv-text-primary)] placeholder:text-[var(--rv-text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--rv-accent)]/40"
          />
          {isFetching && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
            </span>
          )}
        </div>

        {/* Results header */}
        {query.length >= 2 && data && !isError && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[var(--rv-text-dim)]">
              {data.count > 0
                ? <><span className="text-[var(--rv-text-primary)] font-semibold">{data.count}</span> resultado{data.count !== 1 ? "s" : ""} para &ldquo;{query}&rdquo;</>
                : <>Nenhum resultado para &ldquo;{query}&rdquo;</>
              }
            </p>
            {totalPages > 1 && (
              <p className="text-xs text-[var(--rv-text-dim)]">Página {page} de {totalPages}</p>
            )}
          </div>
        )}

        {/* Results list */}
        {isLoading && query.length >= 2 && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-[var(--rv-surface)] animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && !isError && data?.results && data.results.length > 0 && (
          <ul className="space-y-3">
            {data.results.map((topic) => (
              <li key={topic.id}>
                <Link
                  href={`/forum/t/${topic.slug}`}
                  className="rv-card p-4 flex items-start justify-between gap-4 hover:border-[var(--rv-accent)]/30 transition-colors group block"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--rv-text-primary)] group-hover:text-[var(--rv-accent)] transition-colors truncate">
                      {topic.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--rv-text-dim)]">
                      {topic.category && (
                        <span className="rv-badge text-[9px] px-2 py-0.5">{topic.category.name}</span>
                      )}
                      {topic.author_name && <span>{topic.author_name}</span>}
                      {topic.created_at && (
                        <span>{format(new Date(topic.created_at), "dd MMM yyyy", { locale: ptBR })}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1 text-xs text-[var(--rv-text-dim)]">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>{topic.reply_count}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {!isLoading && !isError && data?.results?.length === 0 && query.length >= 2 && (
          <div className="rv-card p-12 flex flex-col items-center text-center gap-4">
            <Search className="h-12 w-12 text-[var(--rv-text-dim)] opacity-30" />
            <p className="text-[var(--rv-text-dim)]">Nenhum tópico encontrado para &ldquo;{query}&rdquo;.</p>
            <Link href="/forum" className="rv-btn rv-btn-ghost h-9 px-6 text-xs">
              Ver todos os tópicos
            </Link>
          </div>
        )}

        {!isLoading && isError && query.length >= 2 && (
          <div className="rv-card p-12 flex flex-col items-center text-center gap-4">
            <Search className="h-12 w-12 text-red-400 opacity-60" />
            <p className="text-red-400">{error instanceof Error ? error.message : "Falha ao buscar tópicos."}</p>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="rv-btn rv-btn-ghost h-9 px-6 text-xs"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {query.length < 2 && (
          <div className="rv-card p-12 flex flex-col items-center text-center gap-3">
            <Search className="h-12 w-12 text-[var(--rv-text-dim)] opacity-20" />
            <p className="text-[var(--rv-text-dim)] text-sm">Digite pelo menos 2 caracteres para buscar.</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rv-btn rv-btn-ghost h-9 px-4 text-xs disabled:opacity-30"
            >
              ← Anterior
            </button>
            <span className="text-sm text-[var(--rv-text-dim)]">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rv-btn rv-btn-ghost h-9 px-4 text-xs disabled:opacity-30"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
