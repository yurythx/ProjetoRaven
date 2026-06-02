import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 — Página não encontrada | Projeto Raven",
  robots: { index: false },
};

export default function NotFoundPage() {
  return (
    <div className="relative min-h-[90dvh] overflow-hidden flex flex-col items-center justify-center px-4 text-center">
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="rv-orb rv-animate-pulse-glow w-[500px] h-[500px] top-[-10%] left-[-20%] bg-[var(--rv-accent)] opacity-15"
        />
        <div
          className="rv-orb rv-animate-pulse-glow w-[350px] h-[350px] bottom-[-5%] right-[-10%] bg-[var(--rv-cyan)] opacity-10 [animation-delay:1.5s]"
        />
      </div>

      <div className="relative z-10 max-w-xl">
        <span className="rv-badge rv-badge-red mb-6 inline-flex">Erro 404</span>

        <div className="rv-display text-[clamp(5rem,20vw,12rem)] leading-none text-[var(--rv-text-primary)] mb-2 select-none">
          4<span className="rv-text-gradient">0</span>4
        </div>

        <h1 className="rv-display text-2xl sm:text-3xl text-[var(--rv-text-primary)] mb-4">
          Página não encontrada
        </h1>

        <p className="text-[var(--rv-text-muted)] mb-10 max-w-sm mx-auto leading-relaxed font-[var(--font-body)]">
          A página que você está procurando não existe, foi movida ou o endereço está incorreto.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className="rv-btn rv-btn-primary px-8 h-11">
            Página inicial
          </Link>
          <Link href="/blog" className="rv-btn rv-btn-ghost px-8 h-11">
            Ver o Blog
          </Link>
          <Link href="/forum" className="rv-btn rv-btn-ghost px-8 h-11">
            Ir ao Fórum
          </Link>
        </div>

        <p className="rv-label text-[9px] text-[var(--rv-text-dim)] mt-12 tracking-[0.3em]">
          ✦ PROJETO RAVEN ✦
        </p>
      </div>
    </div>
  );
}
