"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import Image from "next/image";
import Link from "next/link";
import { useState, useRef } from "react";
import { notify } from "@/lib/notifications";
import { Globe } from "lucide-react";

export default function MePage() {
  const router = useRouter();
  const { user, isLoading, logout, refreshSession } = useAuth();
  const u = (user ?? null) as Record<string, unknown> | null;

  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [formInit, setFormInit] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--rv-accent)] opacity-20" />
          <div className="absolute inset-0 rounded-full border-t-2 border-[var(--rv-accent)] animate-spin" />
        </div>
      </div>
    );
  }

  if (!isLoading && !user) {
    router.replace("/login");
    return null;
  }

  // Lazy-init form state from user data
  if (!formInit && u) {
    setDisplayName(String(u.display_name || ""));
    setBio(String(u.bio || ""));
    setWebsite(String(u.website || ""));
    setFormInit(true);
  }

  const avatarUrl = typeof u?.avatar_url === "string" ? u.avatar_url : null;
  const shownName = String(u?.display_name || u?.username || "Usuário");
  const initial = shownName[0].toUpperCase();

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/accounts/profile/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName, bio, website }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(typeof body.detail === "string" ? body.detail : "Erro ao salvar.");
      }
      await refreshSession();
      notify.success("Perfil atualizado", "Suas informações foram salvas.");
    } catch (err) {
      notify.error("Erro", err instanceof Error ? err.message : "Falha ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append("avatar", file);
      const res = await fetch("/api/accounts/avatar/", { method: "POST", body: form });
      if (!res.ok) throw new Error("Falha ao enviar avatar.");
      await refreshSession();
      notify.success("Avatar atualizado", "");
    } catch (err) {
      notify.error("Erro", err instanceof Error ? err.message : "Falha ao enviar avatar.");
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="relative min-h-screen pb-20">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-orb rv-animate-pulse-glow" style={{ width: "500px", height: "500px", top: "-15%", left: "-10%", background: "var(--rv-accent)" }} />
        <div className="rv-orb" style={{ width: "350px", height: "350px", bottom: "-5%", right: "-5%", background: "var(--rv-cyan)", opacity: 0.2, animationDelay: "2s" }} />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 sm:mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Avatar */}
            <button
              type="button"
              className="relative h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 group"
              onClick={() => avatarInputRef.current?.click()}
              title="Trocar avatar"
              disabled={avatarUploading}
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--rv-accent)] to-[var(--rv-cyan)] rv-glow-purple" />
              <div className="absolute inset-[2px] rounded-[14px] bg-[var(--rv-surface)] overflow-hidden flex items-center justify-center">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={shownName} width={64} height={64} unoptimized className="w-full h-full object-cover" />
                ) : (
                  <span className="rv-display text-2xl text-[var(--rv-accent)]">{initial}</span>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] font-bold uppercase tracking-widest text-white">
                  {avatarUploading ? "..." : "Trocar"}
                </div>
              </div>
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

            <div>
              <div className="flex items-center gap-2">
                <span className="rv-label text-[9px] sm:text-[10px] text-[var(--rv-accent)] tracking-[0.35em]">SEU PERFIL</span>
                {(u?.is_verified || u?.is_admin_verified) ? (
                  <span className="rv-badge rv-badge-cyan text-[8px] px-2 py-0.5">Verificado</span>
                ) : (
                  <span className="rv-badge rv-badge-yellow text-[8px] px-2 py-0.5 animate-pulse">Pendente</span>
                )}
              </div>
              <h1 className="rv-display text-3xl sm:text-4xl md:text-5xl text-[var(--rv-text-primary)] mt-1">{shownName}</h1>
            </div>
          </div>

          <button onClick={() => logout()} className="rv-btn rv-btn-ghost px-6 h-10 border border-red-500/30 text-red-400 hover:bg-red-500/10">
            Sair
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Editar Perfil */}
          <form onSubmit={handleSaveProfile} className="rv-card p-6 space-y-4 md:col-span-2">
            <h3 className="rv-display text-xl text-[var(--rv-text-primary)] mb-2">Editar Perfil</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">Nome de Exibição</label>
                <input
                  className="rv-input"
                  placeholder="Como você quer ser chamado"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">Website</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--rv-text-dim)]" />
                  <input
                    className="rv-input pl-9"
                    placeholder="https://seusite.com"
                    type="url"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                    maxLength={200}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">Bio</label>
              <textarea
                className="rv-input resize-none"
                style={{ minHeight: "6rem", padding: "0.75rem 1rem" }}
                placeholder="Conte um pouco sobre você..."
                value={bio}
                onChange={e => setBio(e.target.value)}
                maxLength={500}
              />
              <p className="text-xs text-[var(--rv-text-dim)] mt-1 text-right">{bio.length}/500</p>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rv-btn rv-btn-primary h-10 px-6 text-xs disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          </form>

          {/* Informações da Conta */}
          <div className="rv-card p-6">
            <h3 className="rv-display text-xl text-[var(--rv-text-primary)] mb-4">Informações da Conta</h3>
            <div className="space-y-4">
              <div>
                <span className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">Username</span>
                <span className="text-sm text-[var(--rv-text-primary)]">{String(u?.username || "—")}</span>
              </div>
              <div>
                <span className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">E-mail</span>
                <span className="text-sm text-[var(--rv-text-primary)]">{String(u?.email || "—")}</span>
              </div>
              <div>
                <span className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">Membro Desde</span>
                <span className="text-sm text-[var(--rv-text-primary)]">{new Date(String(u?.date_joined || Date.now())).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>
          </div>

          {/* Permissões */}
          <div className="rv-card p-6">
            <h3 className="rv-display text-xl text-[var(--rv-text-primary)] mb-4">Permissões e Acesso</h3>
            <div className="space-y-4">
              <div>
                <span className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">Status do E-mail</span>
                <span className={`text-sm font-semibold ${u?.is_verified ? "text-[var(--rv-accent)]" : "text-yellow-400"}`}>
                  {u?.is_verified ? "Verificado" : "Aguardando Confirmação"}
                </span>
              </div>
              <div>
                <span className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">Privilégios Admin</span>
                <span className={`text-sm font-semibold ${u?.is_admin_verified ? "text-[var(--rv-accent)]" : "text-yellow-400"}`}>
                  {u?.is_admin_verified ? "Concedido" : "Nenhum / Padrão"}
                </span>
              </div>
              <div>
                <span className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">Último Acesso (IP)</span>
                <span className="text-sm font-mono text-[var(--rv-cyan)]">{String(u?.last_login_ip || "—")}</span>
              </div>
            </div>
          </div>

          <SecurityCard totpEnabled={Boolean(u?.totp_enabled)} />
        </div>
      </div>
    </div>
  );
}

function SecurityCard({ totpEnabled }: { totpEnabled: boolean }) {
  return (
    <div className="rv-card p-6 md:col-span-2" data-testid="security-card">
      <h3 className="rv-display text-xl text-[var(--rv-text-primary)] mb-4">Segurança</h3>
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">Autenticação de 2 Fatores (2FA)</span>
          <span className={`text-sm font-semibold ${totpEnabled ? "text-[var(--rv-accent)]" : "text-yellow-400"}`}>
            {totpEnabled ? "Ativada" : "Desativada"}
          </span>
        </div>
        {!totpEnabled && (
          <Link href="/me/2fa" className="rv-btn rv-btn-ghost h-9 px-4 text-xs border border-[var(--rv-accent)]/30">
            Ativar 2FA
          </Link>
        )}
        {totpEnabled && (
          <Link href="/me/2fa" className="rv-btn rv-btn-ghost h-9 px-4 text-xs border border-red-500/30 text-red-400">
            Gerenciar 2FA
          </Link>
        )}
      </div>
    </div>
  );
}
