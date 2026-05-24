import type { Metadata } from "next";
import { DashboardCards } from "@/app/dashboard/dashboard-cards";

export const metadata: Metadata = {
  title: "Console Administrativo | RAVEN",
  description: "Portal de controle e operações do ecossistema Raven.",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="rv-badge rv-badge-cyan">◈ Núcleo de Operações</span>
        </div>
        <h1 className="rv-display text-5xl sm:text-7xl text-[var(--rv-text-primary)] tracking-tight">
          Console <span className="text-[var(--rv-accent)]">Central</span>
        </h1>
        <p className="text-[var(--rv-text-muted)] text-sm sm:text-lg max-w-2xl leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
          Bem-vindo ao centro de comando. Gerencie o blog, modere a comunidade e configure os parâmetros vitais do ecossistema Raven.
        </p>
      </div>

      <div className="mt-16 sm:mt-24">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-[var(--rv-gold)] text-lg">◆</span>
          <h2 className="rv-display text-xl text-[var(--rv-text-primary)] uppercase tracking-widest">Acesso Rápido</h2>
        </div>
        <DashboardCards />
      </div>
    </div>
  );
}
