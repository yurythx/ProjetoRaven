"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { ArticleAnalytics } from "@/features/articles/article-analytics";

function Guard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const u = (user ?? null) as Record<string, unknown> | null;
  const canView = Boolean(u?.is_admin || u?.is_blog_editor || u?.is_staff || u?.is_superuser);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-8 w-8 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="text-center py-20">
        <span className="text-4xl block mb-4 opacity-20">🔒</span>
        <h2 className="rv-display text-2xl text-[var(--rv-text-primary)] mb-3">Acesso restrito</h2>
        <p className="text-[var(--rv-text-muted)] text-sm mb-6">
          Apenas editores e administradores podem ver analytics do blog.
        </p>
        <Link href="/dashboard" className="rv-btn rv-btn-ghost h-10 px-6 text-xs">
          ← Voltar ao Dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

export default function DashboardBlogAnalyticsPage() {
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-orb" style={{ width: "600px", height: "600px", top: "-15%", left: "-10%", background: "var(--rv-accent)", opacity: 0.07 }} />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-2 mb-8 rv-label text-[9px] text-[var(--rv-text-dim)]">
          <Link href="/dashboard" className="hover:text-[var(--rv-accent)] transition-colors">Dashboard</Link>
          <span>›</span>
          <Link href="/dashboard/blog" className="hover:text-[var(--rv-accent)] transition-colors">Blog</Link>
          <span>›</span>
          <span className="text-[var(--rv-text-muted)]">Analytics</span>
        </nav>

        <div className="flex items-center gap-3 mb-8">
          <span className="rv-badge rv-badge-cyan">◈ Analytics</span>
          <h1 className="rv-display text-3xl text-[var(--rv-text-primary)]">Analytics do Blog</h1>
        </div>

        <Guard>
          <ArticleAnalytics />
        </Guard>
      </div>
    </div>
  );
}
