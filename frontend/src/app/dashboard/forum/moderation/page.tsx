import type { Metadata } from "next";
import Link from "next/link";
import { ForumModerationPanel } from "@/app/dashboard/forum/moderation/forum-moderation-panel";

export const metadata: Metadata = {
  title: "Moderação do Fórum | Console | RAVEN",
  robots: { index: false, follow: false },
};

export default function ForumModerationPage() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16">
      <div className="space-y-4 mb-10">
        <span className="rv-badge rv-badge-gold">◈ Moderação</span>
        <h1 className="rv-display text-4xl sm:text-6xl text-[var(--rv-text-primary)] tracking-tight">
          Gestão do <span className="text-[var(--rv-accent)]">Fórum</span>
        </h1>
        <p className="text-sm text-[var(--rv-text-muted)] max-w-2xl">
          Supervisione tópicos, modere replies e mantenha a comunidade saudável.{" "}
          <Link href="/forum" className="text-[var(--rv-accent)] hover:underline">Abrir fórum →</Link>
        </p>
        <Link href="/dashboard/forum/categories" className="rv-btn rv-btn-ghost h-9 px-4 text-xs inline-flex items-center gap-2 mt-2">
          ◈ Gerenciar Categorias →
        </Link>
      </div>
      <ForumModerationPanel />
    </div>
  );
}
