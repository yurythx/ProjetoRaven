"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { jsonFetch } from "@/lib/fetch";
import { Loader2, Mail, KeyRound } from "lucide-react";

function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshSession } = useAuth();

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) { setError("Informe o e-mail."); return; }
    if (code.trim().length !== 6) { setError("O código deve ter 6 dígitos."); return; }
    setIsSubmitting(true);
    const result = await jsonFetch("/api/auth/verify-email", {
      method: "POST",
      json: { email: email.trim(), code: code.trim() },
    });
    setIsSubmitting(false);
    if (!result.ok) { setError("Código inválido ou expirado. Tente novamente."); return; }
    await refreshSession();
    router.push("/me");
  }

  async function handleResend() {
    setError(null);
    if (!email.trim()) { setError("Informe o e-mail primeiro."); return; }
    setIsResending(true);
    const res = await jsonFetch("/api/auth/verify-email/resend", {
      method: "POST",
      json: { email: email.trim() },
    });
    setIsResending(false);
    if (!res.ok) { setError("Falha ao reenviar. Tente novamente."); return; }
    setResent(true);
    setTimeout(() => setResent(false), 5000);
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-5rem)] items-center justify-center px-4 py-8">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-orb rv-animate-pulse-glow" style={{ width: "500px", height: "500px", top: "-15%", left: "-10%", background: "var(--rv-accent)" }} />
        <div className="rv-orb" style={{ width: "300px", height: "300px", bottom: "0%", right: "-5%", background: "var(--rv-cyan)", opacity: 0.25 }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo mark */}
        <div className="mb-10 text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-2">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[var(--rv-accent)] to-[var(--rv-cyan)] flex items-center justify-center rv-glow-purple">
              <span className="rv-display text-2xl text-[var(--rv-text-primary)]">R</span>
            </div>
            <span className="rv-label text-[9px] text-[var(--rv-text-dim)] tracking-[0.4em]">PROJETO RAVEN</span>
          </Link>
        </div>

        <div className="rv-card-glass p-6 sm:p-8 md:p-10">
          <div className="mb-8">
            <span className="rv-badge rv-badge-cyan mb-4 inline-flex">◈ Verificação</span>
            <h1 className="rv-display text-2xl sm:text-3xl text-[var(--rv-text-primary)]">Confirmar e-mail</h1>
            <p className="mt-2 text-sm text-[var(--rv-text-muted)]" style={{ fontFamily: "var(--font-body)" }}>
              Enviamos um código de 6 dígitos para o seu e-mail. Insira-o abaixo para ativar sua conta.
            </p>
          </div>

          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="rv-label text-[10px] text-[var(--rv-text-dim)] tracking-[0.2em]">E-MAIL</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--rv-text-dim)]" aria-hidden />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="rv-input pl-10 w-full"
                />
              </div>
            </div>

            {/* Code */}
            <div className="flex flex-col gap-1.5">
              <label className="rv-label text-[10px] text-[var(--rv-text-dim)] tracking-[0.2em]">CÓDIGO DE VERIFICAÇÃO</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--rv-text-dim)]" aria-hidden />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  placeholder="000000"
                  className="rv-input pl-10 w-full tracking-[0.5em] text-center text-lg font-bold"
                />
              </div>
            </div>

            {error && (
              <div className="rv-card border-[var(--rv-red)]/30 bg-[var(--rv-red)]/5 p-3 text-sm text-[var(--rv-red)]">
                {error}
              </div>
            )}

            {resent && (
              <div className="rv-card border-[var(--rv-accent)]/30 bg-[var(--rv-accent)]/5 p-3 text-sm text-[var(--rv-accent)]">
                Código reenviado! Verifique sua caixa de entrada.
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="rv-btn rv-btn-primary h-12 text-sm font-semibold disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar e-mail"}
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="rv-btn rv-btn-ghost h-11 text-sm disabled:opacity-50"
            >
              {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reenviar código"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[var(--rv-text-dim)]">
            Já verificou?{" "}
            <Link href="/login" className="text-[var(--rv-accent)] hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--rv-accent)]" />
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}
