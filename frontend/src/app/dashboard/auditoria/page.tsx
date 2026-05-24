import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { AuditEventsPanel } from "@/app/dashboard/auditoria/audit-events-panel";

export const metadata: Metadata = {
  title: "Auditoria | Console | RAVEN",
  robots: { index: false, follow: false },
};

export default function AuditPage() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16">
      <div className="space-y-4 mb-10">
        <span className="rv-badge rv-badge-purple">◈ Trilha de Auditoria</span>
        <h1 className="rv-display text-4xl sm:text-6xl text-[var(--rv-text-primary)] tracking-tight">
          Histórico de <span className="text-[var(--rv-accent)]">Eventos</span>
        </h1>
        <p className="text-sm text-[var(--rv-text-muted)] max-w-2xl flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 flex-shrink-0" />
          Registro completo de ações administrativas. Todos os eventos são imutáveis.
        </p>
      </div>
      <AuditEventsPanel />
    </div>
  );
}
