"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-foreground/40">Erro 500</p>
      <h1 className="mt-3 text-3xl font-semibold text-foreground">Algo deu errado</h1>
      <p className="mt-2 max-w-sm text-sm text-foreground/60">
        Ocorreu um erro inesperado no servidor. Nossa equipe foi notificada.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg border border-foreground/20 px-5 py-2 text-sm hover:bg-foreground/5"
        >
          Tentar novamente
        </button>
        <button
          onClick={() => router.push("/")}
          className="rounded-lg bg-foreground px-5 py-2 text-sm text-background hover:opacity-90"
        >
          Início
        </button>
      </div>
    </div>
  );
}
