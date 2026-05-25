"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { jsonFetch } from "@/lib/fetch";
import { Loader2, Mail, KeyRound, Eye, EyeOff, ArrowLeft } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) { setError("Informe o e-mail."); return; }
    if (code.trim().length !== 6) { setError("O código deve ter 6 dígitos."); return; }
    if (!password) { setError("Informe a nova senha."); return; }
    if (password.length < 8) { setError("A senha deve ter pelo menos 8 caracteres."); return; }
    if (password !== passwordConfirm) { setError("As senhas não coincidem."); return; }
    setIsSubmitting(true);
    const result = await jsonFetch("/api/auth/password-reset/confirm", {
      method: "POST",
      json: { email: email.trim(), code: code.trim(), new_password: password, new_password_confirm: passwordConfirm },
    });
    setIsSubmitting(false);
    if (!result.ok) { setError("Código inválido ou expirado. Solicite um novo."); return; }
    router.push("/login");
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
            <span className="rv-badge rv-badge-gold mb-4 inline-flex">◈ Nova senha</span>
            <h1 className="rv-display text-2xl sm:text-3xl text-[var(--rv-text-primary)]">Redefinir senha</h1>
            <p className="mt-2 text-sm text-[var(--rv-text-muted)]" style={{ fontFamily: "var(--font-body)" }}>
              Use o código recebido por e-mail para definir uma nova senha.
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
              <label className="rv-label text-[10px] text-[var(--rv-text-dim)] tracking-[0.2em]">CÓDIGO RECEBIDO</label>
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

            {/* New password */}
            <div className="flex flex-col gap-1.5">
              <label className="rv-label text-[10px] text-[var(--rv-text-dim)] tracking-[0.2em]">NOVA SENHA</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  className="rv-input pr-10 w-full"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--rv-text-dim)] hover:text-[var(--rv-text-muted)] transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1.5">
              <label className="rv-label text-[10px] text-[var(--rv-text-dim)] tracking-[0.2em]">CONFIRMAR NOVA SENHA</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  placeholder="Repita a nova senha"
                  className="rv-input pr-10 w-full"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--rv-text-dim)] hover:text-[var(--rv-text-muted)] transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rv-card border-[var(--rv-red)]/30 bg-[var(--rv-red)]/5 p-3 text-sm text-[var(--rv-red)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="rv-btn rv-btn-primary h-12 text-sm font-semibold disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar nova senha"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-1 text-xs text-[var(--rv-text-dim)]">
            <ArrowLeft className="h-3 w-3" />
            <Link href="/forgot-password" className="text-[var(--rv-accent)] hover:underline">
              Solicitar novo código
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--rv-accent)]" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
