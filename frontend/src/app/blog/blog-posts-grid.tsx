"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { fixImageUrl } from "@/lib/utils";

type BlogPostListItem = {
  id: string; title: string; slug: string; excerpt: string;
  author_name: string; author_username?: string | null; category_name: string;
  published_at: string | null; created_at: string;
  view_count: number; read_time_minutes: number;
  image: string | null;
  tags?: string[];
};

type Paginated<T> = { count: number; next: string | null; results: T[] };

interface Props {
  initialPosts: BlogPostListItem[];
  initialPage: number;
  initialHasNext: boolean;
  queryString: string;
}

export function BlogPostsGrid({ initialPosts, initialPage, initialHasNext, queryString }: Props) {
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(initialPage);
  const [hasNext, setHasNext] = useState(initialHasNext);
  const [isPending, startTransition] = useTransition();

  const loadMore = () => {
    startTransition(async () => {
      const nextPage = page + 1;
      const baseQs = queryString ? `${queryString}&page=${nextPage}` : `page=${nextPage}`;
      try {
        const res = await fetch(`/api/blog/posts?${baseQs}`);
        if (!res.ok) return;
        const data = await res.json() as Paginated<BlogPostListItem>;
        setPosts((prev) => [...prev, ...(data.results ?? [])]);
        setPage(nextPage);
        setHasNext(Boolean(data.next));
      } catch {
        // silently ignore
      }
    });
  };

  return (
    <>
      <div className="space-y-4">
        {posts.map((p, idx) => (
          <article
            key={p.id}
            className="rv-card rv-paper group p-5 sm:p-7"
          >
            <div className="flex flex-col sm:flex-row gap-5 sm:gap-7">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rv-label text-[9px] text-[var(--rv-text-dim)]">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-[var(--rv-accent)]" />
                    {p.category_name}
                  </span>
                  <span>•</span>
                  <span suppressHydrationWarning>
                    {p.published_at ? new Date(p.published_at).toLocaleDateString("pt-BR") : "Rascunho"}
                  </span>
                  <span>•</span>
                  <span>{p.read_time_minutes} min</span>
                </div>

                <Link href={`/blog/${p.slug}`} className="mt-3 block">
                  <h3 className="rv-article-title text-xl sm:text-2xl text-[var(--rv-text-primary)] group-hover:text-[var(--rv-accent)] transition-colors">
                    {p.title}
                  </h3>
                </Link>

                <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--rv-text-muted)]">
                  <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">Autores</span>
                  <span className="text-[var(--rv-text-dim)]">—</span>
                  {p.author_username ? (
                    <Link
                      href={`/u/${p.author_username}`}
                      className="hover:text-[var(--rv-accent)] transition-colors"
                    >
                      {p.author_name}
                    </Link>
                  ) : (
                    <span>{p.author_name}</span>
                  )}
                </div>

                {p.excerpt ? (
                  <div className="mt-4">
                    <div className="rv-label text-[9px] text-[var(--rv-text-dim)]">Resumo</div>
                    <p className="rv-article-abstract mt-1 text-sm text-[var(--rv-text-muted)] leading-relaxed line-clamp-4">
                      {p.excerpt}
                    </p>
                  </div>
                ) : null}

                {p.tags && p.tags.length > 0 ? (
                  <div className="mt-4 text-[11px] text-[var(--rv-text-dim)]">
                    <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">Palavras-chave</span>
                    <span className="text-[var(--rv-text-dim)]">: </span>
                    <span className="text-[var(--rv-text-muted)]">{p.tags.slice(0, 6).join(", ")}</span>
                  </div>
                ) : null}

                <div className="mt-5 flex items-center justify-between">
                  <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">
                    {p.view_count.toLocaleString("pt-BR")} visualizações
                  </span>
                  <Link
                    href={`/blog/${p.slug}`}
                    className="rv-btn rv-btn-ghost h-9 px-4 text-[11px]"
                  >
                    Ler artigo
                  </Link>
                </div>
              </div>

              <Link
                href={`/blog/${p.slug}`}
                className="relative sm:w-[220px] sm:flex-shrink-0 overflow-hidden rounded-xl border border-[var(--rv-border)] bg-[var(--rv-surface-2)]"
                aria-label={`Abrir ${p.title}`}
              >
                <div className="relative aspect-video">
                  {p.image ? (
                    <Image
                      src={fixImageUrl(p.image) ?? ""}
                      alt={p.title}
                      fill
                      priority={idx === 0}
                      sizes="(max-width: 640px) 100vw, 220px"
                      className="object-cover object-center"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[var(--rv-text-dim)]">
                      <span className="rv-label text-[9px]">Sem imagem</span>
                    </div>
                  )}
                </div>
              </Link>
            </div>
          </article>
        ))}
      </div>

      {hasNext && (
        <div className="flex justify-center pt-8">
          <button
            onClick={loadMore}
            disabled={isPending}
            className="rv-btn rv-btn-ghost h-11 px-10 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</>
            ) : (
              "Carregar mais →"
            )}
          </button>
        </div>
      )}
    </>
  );
}
