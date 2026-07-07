"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useDebounce } from "@/hooks/use-debounce";

interface Props {
  defaultValue?: string;
  categories: { id: string; name: string; slug: string }[];
}

export function BlogSearchBar({ defaultValue = "", categories }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultValue);
  const debouncedQuery = useDebounce(query, 300);
  const currentQuery = (searchParams.get("q") ?? "").trim();

  useEffect(() => {
    setQuery(defaultValue);
  }, [defaultValue]);

  const navigate = useCallback(
    (q: string, category?: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (q.trim()) {
        params.set("q", q.trim());
      } else {
        params.delete("q");
      }
      if (category !== undefined) {
        if (category) {
          params.set("category", category);
        } else {
          params.delete("category");
        }
      }
      params.delete("page");
      const qs = params.toString();
      const nextUrl = `/blog${qs ? `?${qs}` : ""}`;
      const currentUrl = `/blog${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      if (nextUrl !== currentUrl) {
        router.replace(nextUrl);
      }
    },
    [router, searchParams],
  );

  useEffect(() => {
    if (debouncedQuery.trim() !== currentQuery) {
      navigate(debouncedQuery);
    }
  }, [currentQuery, debouncedQuery, navigate]);

  const currentCategory = searchParams.get("category") ?? "";

  return (
    <div className="rv-card p-4 sm:p-6 bg-[var(--rv-surface-2)]/40 border-white/5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label className="rv-label text-[10px] mb-2 block" htmlFor="blog-q">
            Busca
          </label>
          <div className="relative">
            <input
              id="blog-q"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar..."
              className="rv-input h-10 text-xs pr-9"
              aria-label="Buscar artigos no blog"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--rv-text-dim)]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
            </span>
          </div>
        </div>

        <div>
          <label className="rv-label text-[10px] mb-2 block" htmlFor="blog-category">
            Categoria
          </label>
          <select
            id="blog-category"
            value={currentCategory}
            onChange={(e) => navigate(query, e.target.value)}
            className="rv-input h-10 text-xs"
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setQuery("");
              const params = new URLSearchParams(searchParams.toString());
              ["q", "category", "tag", "sort", "author", "page"].forEach((k) => params.delete(k));
              const s = params.toString();
              router.push(`/blog${s ? `?${s}` : ""}`);
            }}
            className="rv-btn rv-btn-ghost w-full h-10 text-xs"
          >
            Limpar filtros
          </button>
        </div>
      </div>
    </div>
  );
}
