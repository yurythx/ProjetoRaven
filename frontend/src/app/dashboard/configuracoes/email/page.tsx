"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Send, Eye, EyeOff } from "lucide-react";
import { notify } from "@/lib/notifications";

type SMTPSettings = {
  is_enabled: boolean;
  host: string;
  port: number;
  username: string;
  password_set: boolean;
  use_tls: boolean;
  use_ssl: boolean;
  timeout: number;
  from_email: string;
  from_name: string;
  reply_to: string;
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-[var(--rv-accent)]" : "bg-[var(--rv-surface-2)] border border-[var(--rv-border)]"
      }`}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
      <span className="sr-only">{label}</span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="rv-label text-[10px] uppercase ml-1 text-[var(--rv-text-dim)]">{label}</label>
      {children}
    </div>
  );
}

export default function EmailSettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["smtp-settings"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/accounts-admin/smtp-settings/", { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<SMTPSettings>;
    },
  });

  const [isEnabled, setIsEnabled] = React.useState(false);
  const [host, setHost] = React.useState("");
  const [port, setPort] = React.useState(587);
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [useTls, setUseTls] = React.useState(true);
  const [useSsl, setUseSsl] = React.useState(false);
  const [timeoutSecs, setTimeoutSecs] = React.useState(10);
  const [fromEmail, setFromEmail] = React.useState("");
  const [fromName, setFromName] = React.useState("");
  const [replyTo, setReplyTo] = React.useState("");
  const [testTo, setTestTo] = React.useState("");

  React.useEffect(() => {
    if (!data) return;
    setIsEnabled(Boolean(data.is_enabled));
    setHost(data.host ?? "");
    setPort(typeof data.port === "number" ? data.port : 587);
    setUsername(data.username ?? "");
    setUseTls(Boolean(data.use_tls));
    setUseSsl(Boolean(data.use_ssl));
    setTimeoutSecs(typeof data.timeout === "number" ? data.timeout : 10);
    setFromEmail(data.from_email ?? "");
    setFromName(data.from_name ?? "");
    setReplyTo(data.reply_to ?? "");
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/accounts-admin/smtp-settings/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_enabled: isEnabled,
          host: host.trim(),
          port,
          username: username.trim(),
          password: password.trim().length > 0 ? password : "",
          use_tls: useTls,
          use_ssl: useSsl,
          timeout: timeoutSecs,
          from_email: fromEmail.trim(),
          from_name: fromName.trim(),
          reply_to: replyTo.trim(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["smtp-settings"] });
      setPassword("");
      notify.success("Configuração salva com sucesso");
    },
    onError: (error: unknown) => notify.error("Falha ao salvar configurações", error),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/accounts-admin/smtp-settings/test/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_email: testTo.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: () => notify.success("E-mail de teste enviado com sucesso"),
    onError: (error: unknown) => notify.error("Falha ao enviar e-mail de teste", error),
  });

  const inputCls = "rv-input h-11 text-sm";

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
      {/* Header */}
      <div className="bg-[var(--rv-surface-2)]/30 backdrop-blur-md border border-white/5 p-8 sm:p-12 rounded-[2.5rem] relative overflow-hidden mb-12">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 pointer-events-none">
          <Mail className="h-64 w-64 text-[var(--rv-text-primary)]" />
        </div>
        <div className="relative z-10 space-y-4">
          <span className="rv-badge rv-badge-cyan">✦ Comunicações Internas</span>
          <h1 className="rv-display text-5xl sm:text-6xl text-[var(--rv-text-primary)] tracking-tight">
            Serviço de <span className="text-[var(--rv-accent)]">E-mail</span>
          </h1>
          <p className="text-[var(--rv-text-muted)] text-sm sm:text-base max-w-2xl font-[var(--font-body)]">
            Configure os parâmetros SMTP para garantir que as mensagens de sistema, verificação e recuperação cheguem aos heróis.
          </p>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="rv-card p-20 flex items-center justify-center gap-3">
          <div className="h-5 w-5 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
          <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">AGUARDANDO SERVIDOR...</span>
        </div>
      ) : (
        <div className="grid gap-8">
          {/* Main Config */}
          <div className="rv-card p-8 sm:p-10 space-y-8">
            {/* Status toggle */}
            <div className="flex items-center justify-between border-b border-white/5 pb-8">
              <div className="space-y-1">
                <h3 className="rv-display text-xl text-[var(--rv-text-primary)]">Status do Serviço</h3>
                <p className="text-xs text-[var(--rv-text-muted)]">Habilitar ou desabilitar o envio automático.</p>
              </div>
              <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                <Toggle checked={isEnabled} onChange={setIsEnabled} label="Habilitar SMTP" />
                <span className={`rv-display text-sm ${isEnabled ? "text-[var(--rv-accent)]" : "text-[var(--rv-text-dim)]"}`}>
                  {isEnabled ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>

            {/* Connection */}
            <div>
              <h4 className="rv-label text-[9px] text-[var(--rv-text-dim)] tracking-widest mb-4">CONEXÃO</h4>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Host SMTP">
                  <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.seudominio.com" className={inputCls} />
                </Field>
                <Field label="Porta">
                  <input
                    value={String(port)}
                    onChange={(e) => setPort(Number.parseInt(e.target.value || "0", 10) || 0)}
                    type="number"
                    className={inputCls}
                  />
                </Field>
                <Field label="Usuário">
                  <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="usuario@dominio.com" className={inputCls} />
                </Field>
                <Field label={data.password_set ? "Nova senha (deixe vazio para manter)" : "Senha"}>
                  <div className="relative">
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type={showPassword ? "text" : "password"}
                      placeholder={data.password_set ? "••••••••" : "Senha SMTP"}
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--rv-text-dim)] hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
              </div>
            </div>

            {/* Security */}
            <div>
              <h4 className="rv-label text-[9px] text-[var(--rv-text-dim)] tracking-widest mb-4">SEGURANÇA</h4>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex items-center justify-between gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                  <label className="rv-label text-xs text-[var(--rv-text-primary)]">TLS</label>
                  <Toggle checked={useTls} onChange={setUseTls} label="TLS" />
                </div>
                <div className="flex items-center justify-between gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                  <label className="rv-label text-xs text-[var(--rv-text-primary)]">SSL</label>
                  <Toggle checked={useSsl} onChange={setUseSsl} label="SSL" />
                </div>
                <Field label="Timeout (segundos)">
                  <input
                    value={String(timeoutSecs)}
                    onChange={(e) => setTimeoutSecs(Number.parseInt(e.target.value || "0", 10) || 0)}
                    type="number"
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>

            {/* Remetente */}
            <div className="pt-6 border-t border-white/5">
              <h4 className="rv-label text-[9px] text-[var(--rv-text-dim)] tracking-widest mb-4">REMETENTE</h4>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="E-mail">
                  <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="no-reply@dominio.com" className={inputCls} />
                </Field>
                <Field label="Nome">
                  <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Raven Portal" className={inputCls} />
                </Field>
                <Field label="Reply-To">
                  <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="suporte@dominio.com" className={inputCls} />
                </Field>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="rv-btn rv-btn-primary h-11 px-10 text-xs"
              >
                {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
              </button>
            </div>
          </div>

          {/* Test Card */}
          <div className="rv-card p-8 sm:p-10 bg-gradient-to-br from-[var(--rv-surface-2)]/20 to-transparent">
            <h3 className="rv-display text-xl text-[var(--rv-text-primary)] mb-2 flex items-center gap-3">
              <Send className="h-5 w-5 text-[var(--rv-accent)]" /> Validação de Canal
            </h3>
            <p className="text-xs text-[var(--rv-text-muted)] mb-6">
              Envie um e-mail de teste para confirmar que as configurações estão corretas.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                type="email"
                placeholder="email@destinatario.com"
                className="rv-input h-11 flex-1 text-sm"
              />
              <button
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending || !testTo.trim()}
                className="rv-btn rv-btn-secondary h-11 px-8 text-xs"
              >
                {testMutation.isPending ? "Enviando..." : "Enviar Teste"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
