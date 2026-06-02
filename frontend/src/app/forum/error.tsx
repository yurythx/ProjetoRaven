"use client";

import Link from "next/link";

export default function ForumError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="rv-badge rv-badge-red inline-flex">⚠ Erro ao carregar</div>
      <h1 className="rv-display text-4xl text-[var(--rv-text-primary)]">Algo deu errado</h1>
      <p className="text-[var(--rv-text-muted)] max-w-sm text-sm font-[var(--font-body)]">
        Não foi possível carregar esta página do fórum. Tente novamente ou volte ao início.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          onClick={() => reset()}
          className="rv-btn rv-btn-primary px-8 h-11 text-xs"
        >
          Tentar novamente
        </button>
        <Link href="/forum" className="rv-btn rv-btn-ghost px-8 h-11 text-xs">
          Ir ao Fórum
        </Link>
      </div>
    </div>
  );
}
