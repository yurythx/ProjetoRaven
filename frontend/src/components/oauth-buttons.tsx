"use client";

import { useState } from "react";

const PROVIDERS = [
  {
    id:    "google",
    label: "Entrar com Google",
    icon:  (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
  },
] as const;

type Props = { mode?: "login" | "register" };

export function OAuthButtons({ mode = "login" }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function handleOAuth(provider: string) {
    setError(null);
    setLoading(provider);
    try {
      const redirectUri = `${window.location.origin}/auth/oauth-callback?provider=${provider}`;
      const res = await fetch(`/api/auth/oauth/${provider}?redirect_uri=${encodeURIComponent(redirectUri)}`);
      if (!res.ok) throw new Error("Falha ao iniciar autenticação social.");
      const { auth_url } = await res.json() as { auth_url: string };
      window.location.href = auth_url;
    } catch {
      setError("Não foi possível iniciar o login social. Tente novamente.");
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="text-[10px] text-red-400 text-center rv-label">{error}</p>
      )}
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={loading !== null}
          onClick={() => handleOAuth(p.id)}
          className="flex items-center justify-center gap-3 w-full h-11 rounded-xl border border-[var(--rv-border)] bg-[var(--rv-surface)] text-sm text-[var(--rv-text-base)] hover:bg-[var(--rv-surface-2)] hover:border-[var(--rv-accent)]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {loading === p.id ? (
            <span className="h-4 w-4 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
          ) : p.icon}
          {mode === "register" ? p.label.replace("Entrar", "Registrar") : p.label}
        </button>
      ))}
    </div>
  );
}
