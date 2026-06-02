"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import dynamic from "next/dynamic";

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

export default function BlogNovoPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const u = (user ?? null) as Record<string, unknown> | null;
  const canEdit = Boolean(u?.is_admin || u?.is_blog_editor);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-8 w-8 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!canEdit) {
    router.replace("/blog");
    return null;
  }

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-orb rv-animate-pulse-glow w-[500px] h-[500px] top-[-10%] left-[-10%] bg-[var(--rv-accent)] opacity-15" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-2 mb-8 rv-label text-[9px] text-[var(--rv-text-dim)]">
          <button onClick={() => router.push("/blog")} className="hover:text-[var(--rv-accent)] transition-colors">
            Blog
          </button>
          <span>›</span>
          <span className="text-[var(--rv-text-muted)]">Novo Post</span>
        </nav>

        <div className="flex items-center gap-3 mb-8">
          <span className="rv-badge rv-badge-purple">✦ Novo Post</span>
          <h1 className="rv-display text-3xl text-[var(--rv-text-primary)]">Criar Artigo</h1>
        </div>

        <ArticleForm
          onSuccess={() => router.push("/blog")}
          onCancel={() => router.push("/blog")}
        />
      </div>
    </div>
  );
}
