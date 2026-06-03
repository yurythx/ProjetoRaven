"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, CheckCircle, XCircle, Users, ExternalLink, Save, RefreshCw } from "lucide-react";
import { notify } from "@/lib/notifications";

type ProviderStatus = {
  provider: "google";
  is_enabled: boolean;
  client_id: string;
  client_secret_set: boolean;
  env_configured: boolean;
  connected_accounts: number;
  redirect_path: string;
};

const PROVIDER_META = {
  google: {
    label: "Google",
    color: "var(--rv-accent)",
    badge: "rv-badge-cyan",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    ),
    docs_url: "https://console.cloud.google.com/apis/credentials",
    scope_hint: "openid email profile",
    docs_label: "Google Cloud Console",
  },
} as const;

async function fetchProviders(): Promise<ProviderStatus[]> {
  const res = await fetch("/api/accounts-admin/admin/oauth-providers/");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function saveProvider(provider: string, data: { is_enabled?: boolean; client_id?: string; client_secret?: string }) {
  const res = await fetch(`/api/accounts-admin/admin/oauth-providers/${provider}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-[var(--rv-accent)]" : "bg-[var(--rv-surface-2)] border border-[var(--rv-border)]"
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      <span className="sr-only">{label}</span>
    </button>
  );
}

function ProviderCard({ prov }: { prov: ProviderStatus }) {
  const queryClient = useQueryClient();
  const meta = PROVIDER_META[prov.provider];

  const [isEnabled, setIsEnabled] = React.useState(prov.is_enabled);
  const [clientId, setClientId] = React.useState(prov.client_id);
  const [clientSecret, setClientSecret] = React.useState("");
  const [showSecret, setShowSecret] = React.useState(false);

  React.useEffect(() => {
    setIsEnabled(prov.is_enabled);
    setClientId(prov.client_id);
    setClientSecret("");
  }, [prov]);

  const mutation = useMutation({
    mutationFn: () =>
      saveProvider(prov.provider, {
        is_enabled: isEnabled,
        client_id: clientId.trim() || undefined,
        client_secret: clientSecret.trim() || undefined,
      }),
    onSuccess: () => {
      notify.success(`${meta.label} salvo com sucesso`);
      setClientSecret("");
      queryClient.invalidateQueries({ queryKey: ["oauth-providers"] });
    },
    onError: (e: unknown) => notify.error(`Falha ao salvar ${meta.label}`, e),
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => saveProvider(prov.provider, { is_enabled: enabled }),
    onSuccess: (_, enabled) => {
      setIsEnabled(enabled);
      notify.success(`${meta.label} ${enabled ? "habilitado" : "desabilitado"}`);
      queryClient.invalidateQueries({ queryKey: ["oauth-providers"] });
    },
    onError: (e: unknown) => notify.error(`Falha ao alterar ${meta.label}`, e),
  });

  const isConfigured = prov.client_secret_set && prov.client_id;
  const redirectUri = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}${prov.redirect_path}`
    : prov.redirect_path;

  return (
    <div className="rv-card overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[var(--rv-border)] flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
            {meta.icon}
          </div>
          <div>
            <h3 className="rv-display text-xl text-[var(--rv-text-primary)]">{meta.label}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {isConfigured ? (
                <span className="rv-badge rv-badge-cyan text-[8px] flex items-center gap-1">
                  <CheckCircle className="h-2.5 w-2.5" /> Credenciais configuradas
                </span>
              ) : (
                <span className="rv-badge rv-badge-red text-[8px] flex items-center gap-1">
                  <XCircle className="h-2.5 w-2.5" /> Sem credenciais no banco
                </span>
              )}
              {prov.env_configured && (
                <span className="rv-badge rv-badge-gold text-[8px]">Env vars detectadas</span>
              )}
            </div>
          </div>
        </div>

        {/* Toggle + stat */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="rv-display text-2xl text-[var(--rv-text-primary)]">{prov.connected_accounts}</div>
            <div className="rv-label text-[8px] text-[var(--rv-text-dim)] flex items-center gap-1 justify-center mt-0.5">
              <Users className="h-2.5 w-2.5" /> CONTAS VINCULADAS
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Toggle
              checked={isEnabled}
              onChange={(v) => toggleMutation.mutate(v)}
              label={`Habilitar ${meta.label}`}
            />
            <span className={`rv-label text-[9px] ${isEnabled ? "text-[var(--rv-accent)]" : "text-[var(--rv-text-dim)]"}`}>
              {isEnabled ? "Ativo" : "Inativo"}
            </span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="p-6 space-y-6">
        {/* Redirect URI (read-only) */}
        <div>
          <label className="rv-label text-[9px] text-[var(--rv-text-dim)] uppercase tracking-widest block mb-2">
            Redirect URI — copie no painel do provedor
          </label>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={redirectUri}
              className="rv-input h-9 text-xs flex-1 font-mono bg-[var(--rv-surface-2)]/50 cursor-text select-all"
              onFocus={(e) => e.target.select()}
            />
            <a
              href={meta.docs_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rv-btn rv-btn-ghost h-9 px-3 text-[10px] gap-1.5 flex items-center flex-shrink-0"
            >
              <ExternalLink className="h-3 w-3" /> {meta.docs_label}
            </a>
          </div>
          <p className="text-[9px] text-[var(--rv-text-dim)] mt-1.5">
            Scopes necessários: <span className="font-mono text-[var(--rv-text-muted)]">{meta.scope_hint}</span>
          </p>
        </div>

        {/* Credentials */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="rv-label text-[9px] uppercase text-[var(--rv-text-dim)] tracking-widest block">
              Client ID
            </label>
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={`${meta.label} Client ID`}
              className="rv-input h-10 text-sm w-full font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="rv-label text-[9px] uppercase text-[var(--rv-text-dim)] tracking-widest block">
              Client Secret {prov.client_secret_set && <span className="text-[var(--rv-accent)] normal-case">(já configurado — deixe vazio para manter)</span>}
            </label>
            <div className="relative">
              <input
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                type={showSecret ? "text" : "password"}
                placeholder={prov.client_secret_set ? "••••••••••••" : `${meta.label} Client Secret`}
                className="rv-input h-10 text-sm w-full pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowSecret((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--rv-text-dim)] hover:text-white transition-colors"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-[var(--rv-border)]">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rv-btn rv-btn-primary h-10 px-8 text-xs gap-2 flex items-center"
          >
            <Save className="h-3.5 w-3.5" />
            {mutation.isPending ? "Salvando..." : `Salvar ${meta.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OAuthConfigPage() {
  const { data, isLoading, refetch, isFetching } = useQuery<ProviderStatus[]>({
    queryKey: ["oauth-providers"],
    queryFn: fetchProviders,
    staleTime: 30_000,
  });

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16">
      <div className="space-y-4 mb-10">
        <span className="rv-badge rv-badge-purple">◈ Autenticação Social</span>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h1 className="rv-display text-4xl sm:text-6xl text-[var(--rv-text-primary)] tracking-tight">
            Login com <span className="text-[var(--rv-accent)]">Redes Sociais</span>
          </h1>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="rv-btn rv-btn-ghost h-9 px-4 text-xs gap-2 flex items-center"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
        <p className="text-sm text-[var(--rv-text-muted)] max-w-3xl">
          Configure as credenciais OAuth para cada provedor. As credenciais salvas aqui têm prioridade sobre as variáveis de ambiente.
          Usuários poderão se registrar e fazer login com um clique.
        </p>
      </div>

      {isLoading ? (
        <div className="rv-card p-20 flex items-center justify-center gap-3">
          <div className="h-5 w-5 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
          <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">CARREGANDO...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {(data ?? []).map((prov) => (
            <ProviderCard key={prov.provider} prov={prov} />
          ))}
        </div>
      )}
    </div>
  );
}
