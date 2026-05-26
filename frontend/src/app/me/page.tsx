"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { notify } from "@/lib/notifications";
import { Globe, KeyRound, Eye, EyeOff, Mail } from "lucide-react";

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

  // Password change state
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  // Email resend state
  const [resendingVerification, setResendingVerification] = useState(false);

  // Username change state
  const [usernameOpen, setUsernameOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!formInit && u) {
      setDisplayName(String(u.display_name || ""));
      setBio(String(u.bio || ""));
      setWebsite(String(u.website || ""));
      setFormInit(true);
    }
  }, [formInit, u]);

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

  if (!user) return null;

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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      notify.error("Senhas não coincidem", "A nova senha e a confirmação devem ser iguais.");
      return;
    }
    if (newPw.length < 8) {
      notify.error("Senha curta", "A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/accounts/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        const msg = typeof body.error === "string" ? body.error : typeof body.detail === "string" ? body.detail : "Erro ao alterar senha.";
        throw new Error(msg);
      }
      notify.success("Senha alterada", "Sua senha foi atualizada com sucesso.");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setPwOpen(false);
    } catch (err) {
      notify.error("Erro", err instanceof Error ? err.message : "Falha ao alterar senha.");
    } finally {
      setPwSaving(false);
    }
  }

  async function handleChangeUsername(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newUsername.trim();
    if (!trimmed) return;
    setUsernameSaving(true);
    try {
      const res = await fetch("/api/accounts/change-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        const msg = typeof body.error === "string" ? body.error : "Erro ao alterar username.";
        throw new Error(msg);
      }
      await refreshSession();
      notify.success("Username alterado", `Seu novo username é @${trimmed}.`);
      setNewUsername("");
      setUsernameOpen(false);
    } catch (err) {
      notify.error("Erro", err instanceof Error ? err.message : "Falha ao alterar username.");
    } finally {
      setUsernameSaving(false);
    }
  }

  async function handleResendVerification() {
    setResendingVerification(true);
    try {
      const res = await fetch("/api/accounts/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(u?.email || "") }),
      });
      if (!res.ok) throw new Error("Falha ao reenviar.");
      notify.success("E-mail enviado", "Verifique sua caixa de entrada.");
    } catch {
      notify.error("Erro", "Não foi possível reenviar o e-mail de verificação.");
    } finally {
      setResendingVerification(false);
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
                  <Image src={avatarUrl} alt={shownName} fill unoptimized className="object-cover" />
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

          <div className="flex items-center gap-3">
            <button onClick={() => logout()} className="rv-btn rv-btn-ghost px-6 h-10 border border-red-500/30 text-red-400 hover:bg-red-500/10">
              Sair
            </button>
          </div>
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
                {usernameOpen ? (
                  <form onSubmit={handleChangeUsername} className="flex items-center gap-2 mt-1">
                    <input
                      className="rv-input h-8 text-sm flex-1"
                      placeholder={String(u?.username || "")}
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      autoFocus
                      maxLength={30}
                      pattern="[a-zA-Z0-9_]{3,30}"
                      title="3–30 caracteres: letras, números e _"
                    />
                    <button type="submit" disabled={usernameSaving || !newUsername.trim()} className="rv-btn rv-btn-primary h-8 px-3 text-xs disabled:opacity-50">
                      {usernameSaving ? "..." : "Salvar"}
                    </button>
                    <button type="button" onClick={() => { setUsernameOpen(false); setNewUsername(""); }} className="rv-btn rv-btn-ghost h-8 px-3 text-xs">
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-sm text-[var(--rv-text-primary)]">@{String(u?.username || "—")}</span>
                    <button type="button" onClick={() => setUsernameOpen(true)} className="text-[10px] text-[var(--rv-accent)] hover:underline">
                      Alterar
                    </button>
                  </div>
                )}
              </div>
              <div>
                <span className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">E-mail</span>
                <span className="text-sm text-[var(--rv-text-primary)]">{String(u?.email || "—")}</span>
              </div>
              <div>
                <span className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">Membro Desde</span>
                <span className="text-sm text-[var(--rv-text-primary)]" suppressHydrationWarning>{new Date(String(u?.date_joined || Date.now())).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>
          </div>

          {/* Permissões */}
          <div className="rv-card p-6">
            <h3 className="rv-display text-xl text-[var(--rv-text-primary)] mb-4">Permissões e Acesso</h3>
            <div className="space-y-4">
              <div>
                <span className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">Status do E-mail</span>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-sm font-semibold ${u?.is_verified ? "text-[var(--rv-accent)]" : "text-yellow-400"}`}>
                    {u?.is_verified ? "Verificado" : "Aguardando Confirmação"}
                  </span>
                  {!u?.is_verified && (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendingVerification}
                      className="flex items-center gap-1.5 text-[10px] text-[var(--rv-accent)] hover:underline disabled:opacity-50"
                    >
                      <Mail className="h-3 w-3" />
                      {resendingVerification ? "Enviando..." : "Reenviar e-mail"}
                    </button>
                  )}
                </div>
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

          {/* Troca de senha */}
          <div className="rv-card p-6 md:col-span-2">
            <button
              type="button"
              className="w-full flex items-center justify-between gap-3"
              onClick={() => { setPwOpen(o => !o); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }}
            >
              <div className="flex items-center gap-3">
                <KeyRound className="h-4 w-4 text-[var(--rv-accent)]" />
                <h3 className="rv-display text-xl text-[var(--rv-text-primary)]">Alterar Senha</h3>
              </div>
              <span className="text-xs text-[var(--rv-text-dim)]">{pwOpen ? "▲ Fechar" : "▼ Expandir"}</span>
            </button>

            {pwOpen && (
              <form onSubmit={handleChangePassword} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">Senha Atual</label>
                  <div className="relative">
                    <input
                      type={showCurrent ? "text" : "password"}
                      className="rv-input pr-10"
                      placeholder="••••••••"
                      value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowCurrent(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--rv-text-dim)] hover:text-[var(--rv-text-muted)]">
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">Nova Senha</label>
                    <div className="relative">
                      <input
                        type={showNew ? "text" : "password"}
                        className="rv-input pr-10"
                        placeholder="Mín. 8 caracteres"
                        value={newPw}
                        onChange={e => setNewPw(e.target.value)}
                        required
                        minLength={8}
                        autoComplete="new-password"
                      />
                      <button type="button" tabIndex={-1} onClick={() => setShowNew(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--rv-text-dim)] hover:text-[var(--rv-text-muted)]">
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">Confirmar Nova Senha</label>
                    <input
                      type="password"
                      className={`rv-input ${confirmPw && confirmPw !== newPw ? "border-red-500/50 focus:ring-red-500/30" : ""}`}
                      placeholder="Repita a nova senha"
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    {confirmPw && confirmPw !== newPw && (
                      <p className="text-xs text-red-400 mt-1">As senhas não coincidem.</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={pwSaving || !currentPw || !newPw || newPw !== confirmPw}
                    className="rv-btn rv-btn-primary h-10 px-6 text-xs disabled:opacity-50"
                  >
                    {pwSaving ? "Salvando..." : "Alterar Senha"}
                  </button>
                </div>
              </form>
            )}
          </div>

          <SecurityCard totpEnabled={Boolean(u?.totp_enabled)} />
          <PushNotificationsCard />
          <DeleteAccountCard onDeleted={() => logout()} />
        </div>
      </div>
    </div>
  );
}

function DeleteAccountCard({ onDeleted }: { onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/accounts/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(typeof body.error === "string" ? body.error : "Senha incorreta.");
      }
      notify.success("Conta removida", "Seus dados foram anonimizados.");
      onDeleted();
    } catch (err) {
      notify.error("Erro", err instanceof Error ? err.message : "Falha ao remover conta.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rv-card p-6 md:col-span-2 border border-red-500/20">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3"
        onClick={() => { setOpen(o => !o); setPassword(""); }}
      >
        <h3 className="rv-display text-xl text-red-400">Zona de Perigo</h3>
        <span className="text-xs text-[var(--rv-text-dim)]">{open ? "▲ Fechar" : "▼ Expandir"}</span>
      </button>

      {open && (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-[var(--rv-text-muted)]">
            Esta ação é <strong className="text-red-400">irreversível</strong>. Sua conta será desativada e seus dados pessoais anonimizados. Confirme sua senha para continuar.
          </p>
          <form onSubmit={handleDelete} className="flex flex-col sm:flex-row gap-3">
            <input
              type="password"
              className="rv-input flex-1 border-red-500/30 focus:ring-red-500/30"
              placeholder="Senha atual para confirmar"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="submit"
              disabled={deleting || !password}
              className="rv-btn h-10 px-6 text-xs bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
            >
              {deleting ? "Removendo..." : "Remover minha conta"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function PushNotificationsCard() {
  const [status, setStatus] = useState<"idle" | "loading" | "subscribed" | "denied" | "unsupported">("idle");
  const [working, setWorking] = useState(false);

  // Detect current subscription state on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    setStatus("loading");
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        const perm = Notification.permission;
        if (perm === "denied") { setStatus("denied"); return; }
        setStatus(sub ? "subscribed" : "idle");
      } catch { setStatus("idle"); }
    })();
  }, []);

  async function subscribe() {
    setWorking(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setStatus("denied"); return; }

      const keyRes = await fetch("/api/accounts/push/vapid-public-key");
      if (!keyRes.ok) throw new Error("VAPID key indisponível.");
      const { public_key } = await keyRes.json() as { public_key: string };

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key),
      });

      await fetch("/api/accounts/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setStatus("subscribed");
      notify.success("Notificações ativadas", "Você receberá notificações push deste navegador.");
    } catch (err) {
      notify.error("Erro", err instanceof Error ? err.message : "Falha ao ativar notificações.");
    } finally {
      setWorking(false);
    }
  }

  async function unsubscribe() {
    setWorking(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/accounts/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("idle");
      notify.success("Notificações desativadas", "");
    } catch {
      notify.error("Erro", "Falha ao desativar notificações.");
    } finally {
      setWorking(false);
    }
  }

  if (status === "unsupported") return null;

  return (
    <div className="rv-card p-6">
      <h3 className="rv-display text-xl text-[var(--rv-text-primary)] mb-4">Notificações Push</h3>
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">Este navegador</span>
          {status === "loading" && <span className="text-sm text-[var(--rv-text-dim)]">Verificando...</span>}
          {status === "subscribed" && <span className="text-sm font-semibold text-[var(--rv-accent)]">Ativadas</span>}
          {status === "idle" && <span className="text-sm font-semibold text-yellow-400">Desativadas</span>}
          {status === "denied" && <span className="text-sm font-semibold text-red-400">Bloqueadas pelo navegador</span>}
        </div>
        {status === "idle" && (
          <button onClick={subscribe} disabled={working} className="rv-btn rv-btn-ghost h-9 px-4 text-xs border border-[var(--rv-accent)]/30 disabled:opacity-50">
            {working ? "Ativando..." : "Ativar"}
          </button>
        )}
        {status === "subscribed" && (
          <button onClick={unsubscribe} disabled={working} className="rv-btn rv-btn-ghost h-9 px-4 text-xs border border-red-500/30 text-red-400 disabled:opacity-50">
            {working ? "Desativando..." : "Desativar"}
          </button>
        )}
        {status === "denied" && (
          <span className="text-xs text-[var(--rv-text-dim)]">Habilite nas configurações do navegador</span>
        )}
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
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
