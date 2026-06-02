"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);

    const msg = String((error as unknown as { message?: unknown })?.message ?? "");
    const isChunkLoadError =
      (error as unknown as { name?: unknown })?.name === "ChunkLoadError" ||
      msg.includes("ChunkLoadError") ||
      msg.includes("Loading chunk");

    if (isChunkLoadError) {
      const id = setTimeout(() => {
        window.location.reload();
      }, 250);
      return () => clearTimeout(id);
    }
  }, [error]);

  return (
    <div className="relative min-h-[90dvh] overflow-hidden flex flex-col items-center justify-center px-4 text-center">
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="rv-orb rv-animate-pulse-glow w-[500px] h-[500px] top-[-10%] left-[-20%] bg-[var(--rv-red)] opacity-10"
        />
        <div
          className="rv-orb w-[350px] h-[350px] bottom-[-5%] right-[-10%] bg-[var(--rv-accent)] opacity-[0.08] [animation-delay:1.5s]"
        />
      </div>

      <div className="relative z-10 max-w-xl">
        <span className="rv-badge rv-badge-red mb-6 inline-flex">Erro 500</span>

        <div className="rv-display text-[clamp(5rem,20vw,12rem)] leading-none text-[var(--rv-text-primary)] mb-2 select-none">
          5<span className="text-[var(--rv-red)]">0</span>0
        </div>

        <h1 className="rv-display text-2xl sm:text-3xl text-[var(--rv-text-primary)] mb-4">
          Algo deu errado
        </h1>

        <p className="text-[var(--rv-text-muted)] mb-10 max-w-sm mx-auto leading-relaxed font-[var(--font-body)]">
          Ocorreu um erro inesperado. Se o problema persistir, tente recarregar a página.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="rv-btn rv-btn-primary px-8 h-11"
          >
            Tentar novamente
          </button>
          <Link href="/" className="rv-btn rv-btn-ghost px-8 h-11">
            Página inicial
          </Link>
        </div>

        {error.digest && (
          <p className="rv-label text-[9px] text-[var(--rv-text-dim)] mt-8 tracking-[0.2em]">
            ID: {error.digest}
          </p>
        )}

        <p className="rv-label text-[9px] text-[var(--rv-text-dim)] mt-4 tracking-[0.3em]">
          ✦ PROJETO RAVEN ✦
        </p>
      </div>
    </div>
  );
}
