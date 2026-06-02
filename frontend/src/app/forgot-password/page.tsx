"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { jsonFetch } from "@/lib/fetch";
import { Loader2, Mail, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const eMail = email.trim();
    if (!eMail) { setError("Informe o e-mail."); return; }
    setIsSubmitting(true);
    const result = await jsonFetch("/api/auth/password-reset/request", {
      method: "POST",
      json: { email: eMail },
    });
    setIsSubmitting(false);
    if (!result.ok) { setError("Falha ao solicitar. Tente novamente."); return; }
    router.push(`/reset-password?email=${encodeURIComponent(eMail)}`);
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-5rem)] items-center justify-center px-4 py-8">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-orb rv-animate-pulse-glow w-[500px] h-[500px] top-[-15%] left-[-10%] bg-[var(--rv-accent)]" />
        <div className="rv-orb w-[300px] h-[300px] bottom-[0%] right-[-5%] bg-[var(--rv-cyan)] opacity-25" />
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
            <span className="rv-badge rv-badge-purple mb-4 inline-flex">◈ Recuperação</span>
            <h1 className="rv-display text-2xl sm:text-3xl text-[var(--rv-text-primary)]">Esqueceu a senha?</h1>
            <p className="mt-2 text-sm text-[var(--rv-text-muted)] font-[var(--font-body)]">
              Informe seu e-mail e enviaremos um código para você redefinir sua senha.
            </p>
          </div>

          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
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
                  autoFocus
                  className="rv-input pl-10 w-full"
                />
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
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar código de recuperação"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-1 text-xs text-[var(--rv-text-dim)]">
            <ArrowLeft className="h-3 w-3" />
            <Link href="/login" className="text-[var(--rv-accent)] hover:underline">
              Voltar ao login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
