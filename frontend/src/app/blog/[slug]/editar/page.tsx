"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import dynamic from "next/dynamic";
import { ArticleHistory } from "@/features/articles/article-history";

const ArticleForm = dynamic(
  () => import("@/features/articles/article-form").then((m) => m.ArticleForm),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[40vh]">
        <div className="h-8 w-8 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
      </div>
    ),
  }
);

export default function BlogEditarPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug;

  const { user, isLoading: isAuthLoading } = useAuth();
  const u = (user ?? null) as Record<string, unknown> | null;
  const canEdit = Boolean(u?.is_admin || u?.is_blog_editor) && !isAuthLoading;

  const { data: article, isLoading: isArticleLoading, isError } = useQuery({
    queryKey: ["blog-article-edit", slug],
    queryFn: async () => {
      const res = await fetch(`/api/blog-admin/articles/${encodeURIComponent(slug!)}/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: Boolean(slug) && canEdit,
    // Discard cached data when the component unmounts so the form always
    // initialises from a fresh fetch when the user navigates back to this page.
    gcTime: 0,
  });

  React.useEffect(() => {
    if (!isAuthLoading && !canEdit) {
      router.replace("/blog");
    }
  }, [isAuthLoading, canEdit, router]);

  if (isAuthLoading || (canEdit && isArticleLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-8 w-8 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!canEdit) return null;

  if (isError || !article) {
    return (
      <div className="relative min-h-screen">
        <div className="relative z-10 mx-auto max-w-4xl px-4 py-16 text-center">
          <span className="text-4xl mb-6 block opacity-20">◈</span>
          <h2 className="rv-display text-2xl text-[var(--rv-text-primary)] mb-4">Post não encontrado</h2>
          <button
            onClick={() => router.push("/blog")}
            className="rv-btn rv-btn-ghost h-10 px-6 text-xs"
          >
            ← Voltar ao Blog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-orb rv-animate-pulse-glow" style={{ width: "500px", height: "500px", top: "-10%", left: "-10%", background: "var(--rv-accent)", opacity: 0.12 }} />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-2 mb-8 rv-label text-[9px] text-[var(--rv-text-dim)]">
          <button onClick={() => router.push("/blog")} className="hover:text-[var(--rv-accent)] transition-colors">
            Blog
          </button>
          <span>›</span>
          <button onClick={() => router.push(`/blog/${slug}`)} className="hover:text-[var(--rv-accent)] transition-colors truncate max-w-[200px]">
            {article.title}
          </button>
          <span>›</span>
          <span className="text-[var(--rv-text-muted)]">Editar</span>
        </nav>

        <div className="flex items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3 min-w-0">
            <span className="rv-badge rv-badge-purple">✏ Editando</span>
            <h1 className="rv-display text-3xl text-[var(--rv-text-primary)] truncate">{article.title}</h1>
          </div>
          <ArticleHistory articleSlug={slug!} />
        </div>

        <ArticleForm
          initialData={article}
          onSuccess={() => router.push("/blog")}
          onCancel={() => router.push(`/blog/${slug}`)}
        />
      </div>
    </div>
  );
}
