"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { jsonFetch } from "@/lib/fetch";
import { notify } from "@/lib/notifications";
import { ArrowLeft, Shield, ShieldCheck, ShieldOff, RefreshCw, Copy, Check } from "lucide-react";

type Step = "idle" | "setup" | "codes";

interface SetupData {
  secret: string;
  uri: string;
  qr_code: string;
}

export default function TwoFASettingsPage() {
  const router = useRouter();
  const { user, refreshSession } = useAuth();
  const u = user as Record<string, unknown> | null;
  const totpEnabled = Boolean(u?.totp_enabled);

  const [step, setStep] = useState<Step>("idle");
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (!user) {
    router.replace("/login");
    return null;
  }

  async function startSetup() {
    setLoading(true);
    setError(null);
    const res = await jsonFetch<SetupData>("/api/auth/2fa/setup", { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      setError((res.data as Record<string, string> | null)?.detail ?? "Erro ao iniciar configuração.");
      return;
    }
    setSetup(res.data);
    setCode("");
    setStep("setup");
  }

  async function enableTotp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await jsonFetch<{ detail: string }>("/api/auth/2fa/enable", {
      method: "POST",
      json: { code: code.trim() },
    });
    setLoading(false);
    if (!res.ok) {
      setError((res.data as Record<string, string> | null)?.detail ?? "Código inválido.");
      setCode("");
      return;
    }
    await refreshSession();
    notify.success("2FA ativado", "Autenticação de dois fatores ativada com sucesso.");
    setStep("idle");
    setSetup(null);
    setCode("");
  }

  async function disableTotp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await jsonFetch<{ detail: string }>("/api/auth/2fa/disable", {
      method: "POST",
      json: { code: code.trim() },
    });
    setLoading(false);
    if (!res.ok) {
      setError((res.data as Record<string, string> | null)?.detail ?? "Código inválido.");
      setCode("");
      return;
    }
    await refreshSession();
    notify.success("2FA desativado", "Autenticação de dois fatores desativada.");
    setCode("");
  }

  async function regenerateCodes() {
    setLoading(true);
    setError(null);
    const res = await jsonFetch<{ codes: string[] }>("/api/auth/2fa/recovery-codes", { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      setError((res.data as Record<string, string> | null)?.detail ?? "Erro ao gerar códigos.");
      return;
    }
    setRecoveryCodes(res.data?.codes ?? []);
    setStep("codes");
  }

  function copyCode(code: string, idx: number) {
    void navigator.clipboard.writeText(code);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  return (
    <div className="min-h-[calc(100dvh-5rem)] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-lg">
        <Link href="/me" className="inline-flex items-center gap-2 text-xs text-[var(--rv-text-dim)] hover:text-[var(--rv-accent)] transition-colors mb-8 rv-label tracking-wider">
          <ArrowLeft className="h-3 w-3" /> Voltar ao perfil
        </Link>

        <div className="mb-8">
          <h1 className="rv-display text-3xl text-[var(--rv-text-primary)]">
            Autenticação de <span className="text-[var(--rv-accent)]">2 Fatores</span>
          </h1>
          <p className="mt-2 text-sm text-[var(--rv-text-muted)]">
            Proteja sua conta com uma segunda camada de segurança via Google Authenticator ou Authy.
          </p>
        </div>

        {/* Status card */}
        <div className="rv-card p-6 mb-6">
          <div className="flex items-center gap-4">
            {totpEnabled ? (
              <ShieldCheck className="h-10 w-10 text-[var(--rv-accent)] shrink-0" />
            ) : (
              <ShieldOff className="h-10 w-10 text-yellow-400 shrink-0" />
            )}
            <div>
              <p className="text-sm font-semibold text-[var(--rv-text-primary)]">
                {totpEnabled ? "2FA está ativado" : "2FA está desativado"}
              </p>
              <p className="text-xs text-[var(--rv-text-muted)] mt-0.5">
                {totpEnabled
                  ? "Sua conta está protegida com autenticação de dois fatores."
                  : "Ative para adicionar uma camada extra de segurança à sua conta."}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <span>⚠</span> {error}
          </div>
        )}

        {/* ── Setup flow ────────────────────────────── */}
        {step === "setup" && setup && (
          <div className="rv-card p-6 mb-6">
            <h2 className="rv-display text-lg text-[var(--rv-text-primary)] mb-4">
              1. Escaneie o QR Code
            </h2>
            <div className="flex justify-center mb-4">
              <div className="rounded-xl border border-[var(--rv-border)] p-3 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={setup.qr_code} alt="QR code para 2FA" width={180} height={180} />
              </div>
            </div>
            <p className="text-xs text-[var(--rv-text-muted)] text-center mb-2">
              Ou insira o código manualmente no seu aplicativo:
            </p>
            <div className="rounded-lg bg-[var(--rv-surface)] border border-[var(--rv-border)] px-4 py-2 text-center font-mono text-sm text-[var(--rv-accent)] tracking-widest mb-6 break-all">
              {setup.secret}
            </div>

            <h2 className="rv-display text-lg text-[var(--rv-text-primary)] mb-3">
              2. Confirme com o código gerado
            </h2>
            <form onSubmit={enableTotp} className="flex flex-col gap-4">
              <input
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
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setStep("idle"); setSetup(null); setCode(""); setError(null); }}
                  className="rv-btn rv-btn-ghost flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || code.length < 6}
                  className="rv-btn rv-btn-primary flex-1"
                >
                  {loading ? "Verificando..." : "Ativar 2FA"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Recovery codes ────────────────────────── */}
        {step === "codes" && recoveryCodes && (
          <div className="rv-card p-6 mb-6">
            <h2 className="rv-display text-lg text-[var(--rv-text-primary)] mb-2">Códigos de recuperação</h2>
            <p className="text-xs text-[var(--rv-text-muted)] mb-4">
              Guarde esses códigos em local seguro. Cada um pode ser usado uma única vez se você perder acesso ao seu autenticador.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {recoveryCodes.map((c, i) => (
                <button
                  key={i}
                  onClick={() => copyCode(c, i)}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--rv-border)] bg-[var(--rv-surface)] px-3 py-2 font-mono text-sm text-[var(--rv-text-primary)] hover:border-[var(--rv-accent)]/50 transition-colors"
                >
                  <span>{c}</span>
                  {copiedIdx === i ? <Check className="h-3 w-3 text-[var(--rv-accent)]" /> : <Copy className="h-3 w-3 text-[var(--rv-text-dim)]" />}
                </button>
              ))}
            </div>
            <button onClick={() => setStep("idle")} className="rv-btn rv-btn-ghost w-full">
              Fechar
            </button>
          </div>
        )}

        {/* ── Actions (idle) ───────────────────────── */}
        {step === "idle" && (
          <div className="flex flex-col gap-4">
            {!totpEnabled ? (
              <button
                onClick={startSetup}
                disabled={loading}
                className="rv-btn rv-btn-primary w-full h-11 flex items-center justify-center gap-2"
              >
                <Shield className="h-4 w-4" />
                {loading ? "Carregando..." : "Ativar autenticação de 2 fatores"}
              </button>
            ) : (
              <>
                <button
                  onClick={regenerateCodes}
                  disabled={loading}
                  className="rv-btn rv-btn-ghost w-full h-11 flex items-center justify-center gap-2 border border-[var(--rv-border)]"
                >
                  <RefreshCw className="h-4 w-4" />
                  {loading ? "Gerando..." : "Regenerar códigos de recuperação"}
                </button>

                <div className="rv-card p-4 border border-red-500/20">
                  <p className="text-xs text-[var(--rv-text-muted)] mb-3">
                    Para desativar o 2FA, insira o código atual do seu autenticador:
                  </p>
                  <form onSubmit={disableTotp} className="flex flex-col gap-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      className="rv-input text-center tracking-[0.5em]"
                    />
                    <button
                      type="submit"
                      disabled={loading || code.length < 6}
                      className="rv-btn rv-btn-ghost h-9 border border-red-500/30 text-red-400 hover:bg-red-500/10 flex items-center justify-center gap-2"
                    >
                      <ShieldOff className="h-4 w-4" />
                      {loading ? "Desativando..." : "Desativar 2FA"}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
