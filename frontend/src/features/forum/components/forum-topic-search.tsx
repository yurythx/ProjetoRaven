"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";

type TopicResult = {
  id: string;
  title: string;
  slug: string;
  category: { name: string; slug: string } | null;
  reply_count: number;
};

async function searchTopics(q: string): Promise<TopicResult[]> {
  const res = await fetch(`/api/forum/topics/?q=${encodeURIComponent(q)}&page_size=8`);
  if (!res.ok) return [];
  const body = await res.json() as { results?: TopicResult[] } | TopicResult[];
  return Array.isArray(body) ? body : (body.results ?? []);
}

export function ForumTopicSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["forum-search", debouncedQuery],
    queryFn: () => searchTopics(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 15_000,
  });

  const showResults = debouncedQuery.length >= 2;

  return (
    <div className="relative w-full max-w-lg">
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim().length >= 2) {
              router.push(`/forum/busca?q=${encodeURIComponent(query.trim())}`);
              setQuery("");
            }
          }}
          placeholder="Buscar tópicos..."
          className="w-full h-10 rounded-md border border-[var(--rv-border)] bg-[var(--rv-surface)] px-3 pr-10 text-sm text-[var(--rv-text-base)] placeholder:text-[var(--rv-text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--rv-accent)]/40"
          aria-label="Buscar tópicos no fórum"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--rv-text-dim)]">
          {isFetching ? (
            <span className="inline-block h-4 w-4 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
          )}
        </span>
      </div>

      {showResults && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border border-[var(--rv-border)] bg-[var(--rv-surface)] shadow-lg overflow-hidden">
          {results.map((topic) => (
            <li key={topic.id}>
              <Link
                href={`/forum/t/${topic.slug}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-[var(--rv-accent)]/10 transition-colors"
                onClick={() => setQuery("")}
              >
                <span className="truncate text-[var(--rv-text-base)]">{topic.title}</span>
                <span className="shrink-0 text-[10px] text-[var(--rv-text-dim)]">
                  {topic.category?.name ?? ""}
                </span>
              </Link>
            </li>
          ))}
          <li className="border-t border-[var(--rv-border)]">
            <Link
              href={`/forum/busca?q=${encodeURIComponent(debouncedQuery)}`}
              className="flex items-center justify-center gap-2 px-4 py-2 text-xs text-[var(--rv-accent)] hover:bg-[var(--rv-accent)]/10 transition-colors font-semibold"
              onClick={() => setQuery("")}
            >
              Ver todos os resultados →
            </Link>
          </li>
        </ul>
      )}

      {showResults && results.length === 0 && !isFetching && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-[var(--rv-border)] bg-[var(--rv-surface)] px-4 py-3 text-sm text-[var(--rv-text-dim)] shadow-lg">
          Nenhum tópico encontrado para &ldquo;{debouncedQuery}&rdquo;.
        </div>
      )}
    </div>
  );
}
