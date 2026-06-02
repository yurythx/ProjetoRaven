"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { jsonFetch } from "@/lib/fetch";

function TwoFAContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshSession } = useAuth();

  const totpToken = params.get("token") ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!totpToken) {
    return (
      <div className="flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center gap-6 px-4 text-center">
        <p className="text-sm text-[var(--rv-text-muted)]">Token inválido.</p>
        <Link href="/login" className="rv-btn rv-btn-primary px-8 h-11">Voltar ao Login</Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await jsonFetch<{ user: unknown }>("/api/auth/2fa/verify", {
      method: "POST",
      json: { totp_token: totpToken, code: code.trim() },
    });

    setIsSubmitting(false);

    if (!result.ok) {
      const detail =
        (result.data as Record<string, string> | null)?.detail ??
        "Código inválido. Tente novamente.";
      setError(detail);
      setCode("");
      return;
    }

    await refreshSession();
    router.replace("/me");
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-5rem)] items-center justify-center px-4 py-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-orb rv-animate-pulse-glow w-[400px] h-[400px] top-[-10%] left-[-5%] bg-[var(--rv-accent)]" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-10 text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-2">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[var(--rv-accent)] to-[var(--rv-cyan)] flex items-center justify-center rv-glow-purple">
              <span className="rv-display text-2xl text-[var(--rv-text-primary)]">R</span>
            </div>
            <span className="rv-label text-[9px] text-[var(--rv-text-dim)] tracking-[0.4em]">PROJETO RAVEN</span>
          </Link>
        </div>

        <div className="rv-card-glass p-6 sm:p-8">
          <div className="mb-8 text-center">
            <span className="rv-badge rv-badge-purple mb-4 inline-flex">🔐 Autenticação de 2 Fatores</span>
            <h1 className="rv-display text-2xl text-[var(--rv-text-primary)]">Verificação 2FA</h1>
            <p className="mt-2 text-sm text-[var(--rv-text-muted)] font-[var(--font-body)]">
              Abra seu aplicativo autenticador e insira o código de 6 dígitos.
            </p>
          </div>

          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <div>
              <label className="rv-label-field" htmlFor="totp-code">Código</label>
              <input
                id="totp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                required
                className="rv-input text-center tracking-[0.5em] text-lg"
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--rv-red)]/30 bg-[var(--rv-red-glow)] px-4 py-3 text-sm text-red-400">
                <span>⚠</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || code.length < 6}
              className="rv-btn rv-btn-primary w-full h-13 mt-2"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verificando...
                </span>
              ) : (
                <span>Confirmar</span>
              )}
            </button>
          </form>

          <div className="rv-divider my-6" />

          <div className="text-center">
            <Link href="/login" className="rv-label text-[10px] text-[var(--rv-text-muted)] hover:text-[var(--rv-accent)] transition-colors">
              ← Voltar ao Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TwoFAPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-[var(--rv-text-primary)]">Carregando...</div>}>
      <TwoFAContent />
    </Suspense>
  );
}
