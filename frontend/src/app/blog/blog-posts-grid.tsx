"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { fixImageUrl } from "@/lib/utils";

type BlogPostListItem = {
  id: string; title: string; slug: string; excerpt: string;
  author_name: string; category_name: string;
  published_at: string | null; created_at: string;
  view_count: number; read_time_minutes: number;
  image: string | null;
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
      <div className="grid gap-6 sm:grid-cols-2">
        {posts.map((p, idx) => (
          <article key={p.id} className="rv-card group flex flex-col hover:scale-[1.02] transition-all duration-300">
            <Link href={`/blog/${p.slug}`} className="relative h-36 sm:h-44 overflow-hidden rounded-t-2xl border-b border-white/5">
              {p.image ? (
                <Image
                  src={fixImageUrl(p.image) ?? ""}
                  alt={p.title}
                  fill
                  unoptimized
                  priority={idx === 0}
                  className="object-cover group-hover:scale-110 transition-transform duration-700"
                />
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
