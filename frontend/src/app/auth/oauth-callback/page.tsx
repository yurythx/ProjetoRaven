"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function OAuthCallbackContent() {
  const router     = useRouter();
  const params     = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code     = params.get("code")     ?? "";
    const state    = params.get("state")    ?? "";
    const provider = params.get("provider") ?? "";
    const errorMsg = params.get("error");

    if (errorMsg) {
      setError("O provedor recusou a autorização. Tente novamente.");
      return;
    }

    if (!code || !state || !provider) {
      setError("Parâmetros de callback incompletos.");
      return;
    }

    const redirectUri = `${window.location.origin}/auth/oauth-callback?provider=${provider}`;

    fetch(`/api/auth/oauth/${provider}/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state, redirect_uri: redirectUri }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `Erro ${res.status}`);
        }
        return res.json();
      })
      .then(() => {
        router.replace("/me");
      })
      .catch((err: Error) => {
        setError(err.message || "Falha ao autenticar com o provedor social.");
      });
  }, [params, router]);

  if (error) {
    return (
      <div className="flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="text-4xl">⚠</div>
        <h1 className="rv-display text-2xl text-[var(--rv-text-primary)]">Falha no Login Social</h1>
        <p className="text-sm text-[var(--rv-text-muted)] max-w-sm" style={{ fontFamily: "var(--font-body)" }}>
          {error}
        </p>
        <button
          onClick={() => router.replace("/login")}
          className="rv-btn rv-btn-primary px-8 h-11"
        >
          Voltar ao Login
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center gap-6">
      <div className="relative h-16 w-16 animate-spin">
        <div className="absolute inset-0 rounded-full border-t-2 border-[var(--rv-accent)]" />
      </div>
      <p className="rv-label text-[10px] text-[var(--rv-text-dim)] tracking-[0.4em]">AUTENTICANDO...</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-[var(--rv-text-primary)]">Carregando...</div>}>
      <OAuthCallbackContent />
    </Suspense>
  );
}

