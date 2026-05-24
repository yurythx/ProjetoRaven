import type { Metadata } from "next";
import { UserAdminPanel } from "@/app/dashboard/usuarios/user-admin-panel";
import { Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Usuários | Dashboard | RAVEN",
  robots: { index: false, follow: false },
};

export default function UserAdminPage() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-16 sm:py-24">
      <div className="bg-[var(--rv-surface-2)]/30 backdrop-blur-md border border-white/5 p-8 sm:p-12 rounded-[2.5rem] relative overflow-hidden mb-12">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 pointer-events-none">
          <Users className="h-64 w-64 text-[var(--rv-text-primary)]" />
        </div>
        
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <span className="rv-badge rv-badge-cyan">✦ Gestão de Identidade</span>
          </div>
          <h1 className="rv-display text-5xl sm:text-6xl text-[var(--rv-text-primary)] tracking-tight">
            Gestão de <span className="text-[var(--rv-accent)]">Usuários</span>
          </h1>
          <p className="text-[var(--rv-text-muted)] text-sm sm:text-base max-w-2xl font-medium" style={{ fontFamily: "var(--font-body)" }}>
            Administração de contas, grupos e níveis de acesso ao ecossistema Raven.
          </p>
        </div>
      </div>

      <div className="relative z-10">
        <UserAdminPanel />
      </div>
    </div>
  );
}
