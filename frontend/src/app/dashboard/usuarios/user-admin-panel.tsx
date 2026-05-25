"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { useDebounce } from "@/hooks/use-debounce";
import { notify } from "@/lib/notifications";
import {
  Search, X, ChevronLeft, ChevronRight, UserPlus,
  ShieldOff, Ban, CheckCircle, KeyRound, Eye, EyeOff,
  UserCheck, Clock, Calendar, Users,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

type UserListItem = {
  id: string; uuid: string; email: string; username: string;
  display_name: string | null; is_active: boolean; is_banned: boolean;
  is_verified: boolean; is_staff: boolean; is_superuser: boolean;
  groups: string[]; date_joined: string; last_login: string | null;
};

type UserDetail = UserListItem & { birth_date: string | null; gender: string | null; ban_reason: string | null };

type AdminAuditEvent = {
  id: string; created_at: string; action: string;
  actor: { id: string; email: string; username: string; display_name: string | null } | null;
  target: { id: string; email: string; username: string; display_name: string | null };
  metadata: Record<string, unknown>; ip_address: string | null; user_agent: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function parsePaginated<T>(body: unknown): Paginated<T> {
  if (Array.isArray(body)) return { count: body.length, next: null, previous: null, results: body as T[] };
  const b = body as { count?: number; next?: string | null; previous?: string | null; results?: unknown } | null;
  if (b && Array.isArray(b.results))
    return { count: b.count ?? b.results.length, next: b.next ?? null, previous: b.previous ?? null, results: b.results as T[] };
  return { count: 0, next: null, previous: null, results: [] };
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(v: string | null): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const GROUP_LABELS: Record<string, string> = {
  members: "Membros",
  blog_editors: "Editores de Blog",
  forum_moderators: "Moderadores",
  admins: "Administradores",
};

const AUDIT_LABELS: Record<string, string> = {
  create_user: "Criar usuário", register_user: "Cadastro", email_verify_sent: "E-mail verificação",
  email_verified: "E-mail verificado", password_reset_sent: "Reset enviado",
  password_reset_confirmed: "Reset confirmado", activate: "Ativar", deactivate: "Desativar",
  ban: "Banir", unban: "Remover ban", reset_password: "Resetar senha",
  change_groups: "Alterar grupos", update_user: "Atualizar", admin_verified: "Verificar (admin)",
};

function auditDetails(ev: AdminAuditEvent): string {
  const m = ev.metadata;
  if (!m) return "";
  if (ev.action === "ban" && typeof m.reason === "string") return `Motivo: ${m.reason}`;
  if (ev.action === "change_groups") {
    const from = Array.isArray(m.from) ? (m.from as string[]).join(", ") : "";
    const to = Array.isArray(m.to) ? (m.to as string[]).join(", ") : "";
    return `${from || "—"} → ${to || "—"}`;
  }
  if (ev.action === "update_user" && m.changes && typeof m.changes === "object")
    return `Campos: ${Object.keys(m.changes as object).join(", ")}`;
  return "";
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ label, variant }: { label: string; variant: "green" | "red" | "yellow" | "purple" | "cyan" | "dim" }) {
  const cls: Record<string, string> = {
    green: "rv-badge rv-badge-cyan", red: "rv-badge rv-badge-red",
    yellow: "rv-badge rv-badge-gold", purple: "rv-badge rv-badge-purple",
    cyan: "rv-badge rv-badge-cyan", dim: "rv-badge",
  };
  return <span className={`${cls[variant]} text-[9px]`}>{label}</span>;
}

function Spinner() {
  return <div className="h-5 w-5 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />;
}

// ── Modal Tabs ─────────────────────────────────────────────────────────────────

type ModalTab = "info" | "permissoes" | "seguranca" | "auditoria";

function InfoTab({ user, onActivate, onDeactivate, onBanClick, onUnban, onVerify, isLoading, currentUserId }: {
  user: UserDetail;
  onActivate: () => void; onDeactivate: () => void;
  onBanClick: () => void; onUnban: () => void; onVerify: () => void;
  isLoading: boolean; currentUserId: string | null;
}) {
  const isSelf = currentUserId !== null && String(user.id) === currentUserId;
  return (
    <div className="flex flex-col gap-5">
      {/* Identity */}
      <div className="rv-card p-4 flex flex-col gap-3 bg-white/[0.03]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--rv-text-primary)]">{user.display_name || user.username}</p>
            <p className="text-xs text-[var(--rv-text-muted)]">@{user.username}</p>
            <p className="text-xs text-[var(--rv-text-dim)] mt-0.5">{user.email}</p>
          </div>
          <div className="flex flex-wrap gap-1 justify-end">
            {user.is_active ? <StatusBadge label="Ativo" variant="green" /> : <StatusBadge label="Inativo" variant="red" />}
            {user.is_banned && <StatusBadge label="Banido" variant="red" />}
            {user.is_verified && <StatusBadge label="Verificado" variant="cyan" />}
            {user.is_staff && <StatusBadge label="Staff" variant="purple" />}
            {user.is_superuser && <StatusBadge label="Superuser" variant="yellow" />}
          </div>
        </div>
        <div className="rv-divider" />
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 text-[var(--rv-text-muted)]">
            <Calendar className="h-3.5 w-3.5 opacity-50 shrink-0" />
            <span>Criado: {fmtDate(user.date_joined)}</span>
          </div>
          <div className="flex items-center gap-2 text-[var(--rv-text-muted)]">
            <Clock className="h-3.5 w-3.5 opacity-50 shrink-0" />
            <span>Login: {fmtDateTime(user.last_login)}</span>
          </div>
        </div>
        {user.is_banned && user.ban_reason && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-[10px] text-red-400 font-medium mb-1">Motivo do ban</p>
            <p className="text-xs text-red-300">{user.ban_reason}</p>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex flex-col gap-2">
        <p className="rv-label text-[9px] text-[var(--rv-text-dim)] uppercase tracking-widest">Ações rápidas</p>
        <div className="flex flex-wrap gap-2">
          {user.is_active ? (
            <button
              onClick={onDeactivate} disabled={isLoading || user.is_superuser || isSelf}
              className="rv-btn rv-btn-ghost h-8 px-4 text-xs flex items-center gap-2 disabled:opacity-30"
            >
              <EyeOff className="h-3.5 w-3.5" /> Desativar
            </button>
          ) : (
            <button
              onClick={onActivate} disabled={isLoading}
              className="rv-btn rv-btn-ghost h-8 px-4 text-xs flex items-center gap-2 disabled:opacity-30"
            >
              <Eye className="h-3.5 w-3.5" /> Ativar
            </button>
          )}

          {user.is_banned ? (
            <button
              onClick={onUnban} disabled={isLoading}
              className="rv-btn rv-btn-ghost h-8 px-4 text-xs flex items-center gap-2 disabled:opacity-30"
            >
              <CheckCircle className="h-3.5 w-3.5 text-green-400" /> Remover ban
            </button>
          ) : (
            <button
              onClick={onBanClick} disabled={isLoading || user.is_superuser || isSelf}
              className="rv-btn h-8 px-4 text-xs flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-30"
            >
              <Ban className="h-3.5 w-3.5" /> Banir
            </button>
          )}

          {!user.is_verified && (
            <button
              onClick={onVerify} disabled={isLoading}
              className="rv-btn rv-btn-ghost h-8 px-4 text-xs flex items-center gap-2 disabled:opacity-30"
            >
              <UserCheck className="h-3.5 w-3.5 text-[var(--rv-accent)]" /> Verificar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PermissoesTab({ user, groupList, groupsDraft, setGroupsDraft, adminDraft, setAdminDraft, onSave, isLoading, isSuperuser, currentUserId }: {
  user: UserDetail; groupList: string[];
  groupsDraft: string[]; setGroupsDraft: (v: string[]) => void;
  adminDraft: boolean; setAdminDraft: (v: boolean) => void;
  onSave: () => void; isLoading: boolean; isSuperuser: boolean; currentUserId: string | null;
}) {
  const isSelf = currentUserId !== null && String(user.id) === currentUserId;
  const canEditSelf = !user.is_superuser && !isSelf;

  const toggleGroup = (g: string) => {
    setGroupsDraft(
      groupsDraft.includes(g) ? groupsDraft.filter((x) => x !== g) : [...groupsDraft, g]
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="rv-label text-[9px] text-[var(--rv-text-dim)] uppercase tracking-widest">Nível de acesso</p>
        <label className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
          adminDraft ? "border-[var(--rv-accent)]/40 bg-[var(--rv-accent)]/10" : "border-[var(--rv-border)] hover:border-[var(--rv-border-hover)]"
        } ${!canEditSelf ? "opacity-50 cursor-not-allowed" : ""}`}>
          <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
            adminDraft ? "border-[var(--rv-accent)] bg-[var(--rv-accent)]" : "border-[var(--rv-border)]"
          }`}>
            {adminDraft && <CheckCircle className="h-3 w-3 text-white" />}
          </div>
          <input
            type="checkbox" className="sr-only" checked={adminDraft}
            disabled={!canEditSelf}
            onChange={(e) => canEditSelf && setAdminDraft(e.target.checked)}
          />
          <div>
            <p className="text-xs text-[var(--rv-text-primary)] font-medium text-[var(--rv-text-primary)]">Administrador (is_staff)</p>
            <p className="text-[10px] text-[var(--rv-text-dim)]">Acesso ao painel e operações de gestão</p>
          </div>
        </label>
      </div>

      {groupList.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="rv-label text-[9px] text-[var(--rv-text-dim)] uppercase tracking-widest">Grupos</p>
          <div className="grid grid-cols-2 gap-2">
            {groupList.map((g) => {
              const checked = groupsDraft.includes(g);
              const locked = g === "admins" && !isSuperuser;
              return (
                <label key={g} className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors ${
                  checked ? "border-[var(--rv-accent)]/40 bg-[var(--rv-accent)]/10" : "border-[var(--rv-border)] hover:border-[var(--rv-border-hover)]"
                } ${locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
                  <div className={`h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    checked ? "border-[var(--rv-accent)] bg-[var(--rv-accent)]" : "border-[var(--rv-border)]"
                  }`}>
                    {checked && <CheckCircle className="h-3 w-3 text-white" />}
                  </div>
                  <input
                    type="checkbox" className="sr-only" checked={checked} disabled={locked}
                    onChange={() => !locked && toggleGroup(g)}
                  />
                  <span className="text-xs text-[var(--rv-text-primary)]">{GROUP_LABELS[g] ?? g}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button onClick={onSave} disabled={isLoading} className="rv-btn rv-btn-primary h-9 px-6 text-xs disabled:opacity-40">
          {isLoading ? <Spinner /> : "Salvar permissões"}
        </button>
      </div>
    </div>
  );
}

function SegurancaTab({ onReset, isLoading }: {
  userId?: string; onReset: (pwd: string) => void; isLoading: boolean;
}) {
  const [pwd, setPwd] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const mismatch = confirm.length > 0 && pwd !== confirm;
  const tooShort = pwd.length > 0 && pwd.length < 8;

  const handle = () => {
    if (!pwd) { notify.warning("Informe a senha"); return; }
    if (pwd.length < 8) { notify.warning("Senha muito curta", "Mínimo 8 caracteres."); return; }
    if (pwd !== confirm) { notify.warning("Senhas não conferem"); return; }
    onReset(pwd);
    setPwd(""); setConfirm("");
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="rv-label text-[9px] text-[var(--rv-text-dim)] uppercase tracking-widest">Redefinir senha</p>
      <div className="flex flex-col gap-3">
        <div className="relative">
          <input
            value={pwd} onChange={(e) => setPwd(e.target.value)}
            type={show ? "text" : "password"} placeholder="Nova senha (mín. 8 caracteres)"
            className="rv-input h-10 text-xs w-full pr-10"
          />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--rv-text-dim)] hover:text-white">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <input
          value={confirm} onChange={(e) => setConfirm(e.target.value)}
          type={show ? "text" : "password"} placeholder="Confirmar nova senha"
          className={`rv-input h-10 text-xs ${mismatch ? "border-red-500/50" : ""}`}
        />
        {(mismatch || tooShort) && (
          <p className="text-[10px] text-red-400">{tooShort ? "Mínimo 8 caracteres." : "Senhas não conferem."}</p>
        )}
      </div>
      <div className="flex justify-end">
        <button onClick={handle} disabled={isLoading || mismatch || tooShort || !pwd}
          className="rv-btn rv-btn-ghost h-9 px-6 text-xs flex items-center gap-2 disabled:opacity-40">
          {isLoading ? <Spinner /> : <><KeyRound className="h-3.5 w-3.5" /> Redefinir senha</>}
        </button>
      </div>
    </div>
  );
}

function AuditoriaTab({ events, isLoading }: { events: AdminAuditEvent[]; isLoading: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {isLoading ? (
        <div className="flex items-center justify-center py-8 gap-3">
          <Spinner /><span className="text-xs text-[var(--rv-text-dim)]">Carregando...</span>
        </div>
      ) : events.length === 0 ? (
        <p className="text-center text-xs text-[var(--rv-text-dim)] py-8">Nenhuma ação registrada.</p>
      ) : (
        <div className="flex flex-col divide-y divide-[var(--rv-border)]">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-start justify-between gap-3 py-3">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="rv-badge rv-badge-purple text-[8px]">{AUDIT_LABELS[ev.action] ?? ev.action}</span>
                  {ev.actor && (
                    <span className="text-[10px] text-[var(--rv-text-dim)]">por {ev.actor.email}</span>
                  )}
                </div>
                {auditDetails(ev) && (
                  <span className="text-[10px] text-[var(--rv-text-muted)]">{auditDetails(ev)}</span>
                )}
              </div>
              <span className="text-[10px] text-[var(--rv-text-dim)] whitespace-nowrap shrink-0">{fmtDateTime(ev.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Edit Modal ─────────────────────────────────────────────────────────────────

function EditModal({
  userId, isOpen, onClose,
  groupList, isSuperuser, currentUserId,
  onRefresh,
}: {
  userId: string | null; isOpen: boolean; onClose: () => void;
  groupList: string[]; isSuperuser: boolean; currentUserId: string | null;
  onRefresh: () => void;
}) {
  const [tab, setTab] = React.useState<ModalTab>("info");
  const [banOpen, setBanOpen] = React.useState(false);
  const [banReason, setBanReason] = React.useState("");
  const [groupsDraft, setGroupsDraft] = React.useState<string[]>([]);
  const [adminDraft, setAdminDraft] = React.useState(false);

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ["admin-user", userId],
    enabled: isOpen && Boolean(userId),
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/accounts-admin/users/${userId}/`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<UserDetail>;
    },
  });

  const { data: auditData, isLoading: loadingAudit } = useQuery({
    queryKey: ["admin-audit", userId],
    enabled: isOpen && Boolean(userId) && tab === "auditoria",
    queryFn: async ({ signal }) => {
      const qs = new URLSearchParams({ page: "1", page_size: "15", ordering: "-created_at" });
      if (userId) qs.set("target", userId);
      const res = await fetch(`/api/accounts-admin/audit-events/?${qs}`, { signal });
      if (!res.ok) throw new Error();
      return parsePaginated<AdminAuditEvent>(await res.json());
    },
  });

  React.useEffect(() => {
    if (user && isOpen) {
      setGroupsDraft(Array.isArray(user.groups) ? user.groups : []);
      setAdminDraft(Boolean(user.is_staff));
    }
  }, [user, isOpen]);

  React.useEffect(() => {
    if (!isOpen) { setTab("info"); setBanOpen(false); setBanReason(""); }
  }, [isOpen]);

  const activateMut = useMutation({
    mutationFn: () => fetch(`/api/accounts-admin/users/${userId}/activate/`, { method: "POST" }).then((r) => { if (!r.ok) throw new Error(); }),
    onSuccess: () => { onRefresh(); notify.success("Usuário ativado"); },
    onError: () => notify.error("Falha ao ativar"),
  });

  const deactivateMut = useMutation({
    mutationFn: () => fetch(`/api/accounts-admin/users/${userId}/deactivate/`, { method: "POST" }).then((r) => { if (!r.ok) throw new Error(); }),
    onSuccess: () => { onRefresh(); notify.success("Usuário desativado"); },
    onError: () => notify.error("Falha ao desativar"),
  });

  const banMut = useMutation({
    mutationFn: (reason: string) =>
      fetch(`/api/accounts-admin/users/${userId}/ban/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }).then((r) => { if (!r.ok) throw new Error(); }),
    onSuccess: () => { onRefresh(); notify.success("Usuário banido"); setBanOpen(false); setBanReason(""); },
    onError: () => notify.error("Falha ao banir"),
  });

  const unbanMut = useMutation({
    mutationFn: () => fetch(`/api/accounts-admin/users/${userId}/unban/`, { method: "POST" }).then((r) => { if (!r.ok) throw new Error(); }),
    onSuccess: () => { onRefresh(); notify.success("Ban removido"); },
    onError: () => notify.error("Falha ao desbanir"),
  });

  const verifyMut = useMutation({
    mutationFn: () => fetch(`/api/accounts-admin/users/${userId}/verify_admin/`, { method: "POST" }).then((r) => { if (!r.ok) throw new Error(); }),
    onSuccess: () => { onRefresh(); notify.success("Usuário verificado"); },
    onError: () => notify.error("Falha ao verificar"),
  });

  const updateGroupsMut = useMutation({
    mutationFn: () =>
      fetch(`/api/accounts-admin/users/${userId}/`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: groupsDraft, is_staff: adminDraft }),
      }).then((r) => { if (!r.ok) throw new Error(); }),
    onSuccess: () => { onRefresh(); notify.success("Permissões salvas"); },
    onError: () => notify.error("Falha ao salvar permissões"),
  });

  const resetPwdMut = useMutation({
    mutationFn: (newPassword: string) =>
      fetch(`/api/accounts-admin/users/${userId}/reset_password/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: newPassword }),
      }).then((r) => { if (!r.ok) throw new Error(); }),
    onSuccess: () => notify.success("Senha redefinida"),
    onError: () => notify.error("Falha ao redefinir senha"),
  });

  const anyLoading = activateMut.isPending || deactivateMut.isPending || banMut.isPending || unbanMut.isPending || verifyMut.isPending;

  if (!isOpen) return null;

  const TABS: { id: ModalTab; label: string }[] = [
    { id: "info", label: "Info" },
    { id: "permissoes", label: "Permissões" },
    { id: "seguranca", label: "Segurança" },
    { id: "auditoria", label: "Auditoria" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
      <div className="rv-card w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--rv-border)]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[var(--rv-accent)]/20 border border-[var(--rv-accent)]/30 flex items-center justify-center">
              <Users className="h-4 w-4 text-[var(--rv-accent)]" />
            </div>
            <div>
              <p className="rv-display text-sm text-[var(--rv-text-primary)]">Gerenciar usuário</p>
              {user && <p className="text-[10px] text-[var(--rv-text-dim)]">{user.email}</p>}
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-xl border border-[var(--rv-border)] flex items-center justify-center text-[var(--rv-text-dim)] hover:text-white hover:border-[var(--rv-border-hover)] transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4 pb-0">
          {TABS.map((t) => (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              className={`h-8 px-4 rounded-t-lg text-[10px] rv-label transition-all border border-b-0 ${
                tab === t.id
                  ? "border-[var(--rv-border)] border-b-[var(--rv-surface)] bg-[var(--rv-surface)] text-[var(--rv-accent)]"
                  : "border-transparent text-[var(--rv-text-dim)] hover:text-[var(--rv-text-muted)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loadingUser ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <Spinner /><span className="text-sm text-[var(--rv-text-dim)]">Carregando...</span>
            </div>
          ) : !user ? (
            <p className="text-center text-sm text-[var(--rv-text-dim)] py-12">Usuário não encontrado.</p>
          ) : (
            <>
              {tab === "info" && (
                <InfoTab
                  user={user} isLoading={anyLoading} currentUserId={currentUserId}
                  onActivate={() => activateMut.mutate()} onDeactivate={() => deactivateMut.mutate()}
                  onBanClick={() => setBanOpen(true)} onUnban={() => unbanMut.mutate()}
                  onVerify={() => verifyMut.mutate()}
                />
              )}
              {tab === "permissoes" && (
                <PermissoesTab
                  user={user} groupList={groupList} groupsDraft={groupsDraft}
                  setGroupsDraft={setGroupsDraft} adminDraft={adminDraft} setAdminDraft={setAdminDraft}
                  onSave={() => updateGroupsMut.mutate()} isLoading={updateGroupsMut.isPending}
                  isSuperuser={isSuperuser} currentUserId={currentUserId}
                />
              )}
              {tab === "seguranca" && (
                <SegurancaTab userId={user.id} onReset={(p) => resetPwdMut.mutate(p)} isLoading={resetPwdMut.isPending} />
              )}
              {tab === "auditoria" && (
                <AuditoriaTab events={auditData?.results ?? []} isLoading={loadingAudit} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Ban sub-dialog */}
      {banOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="rv-card p-6 max-w-sm w-full flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-red-500/20 flex items-center justify-center">
                <Ban className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--rv-text-primary)]">Banir usuário</p>
                {user && <p className="text-[10px] text-[var(--rv-text-dim)]">{user.email}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-[var(--rv-text-muted)]">Motivo (mínimo 10 caracteres)</label>
              <textarea
                value={banReason} onChange={(e) => setBanReason(e.target.value)}
                placeholder="Descreva o motivo do banimento..."
                rows={3}
                className="rv-input text-xs resize-none p-3"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setBanOpen(false); setBanReason(""); }} className="rv-btn rv-btn-ghost h-8 px-4 text-xs">Cancelar</button>
              <button
                onClick={() => {
                  const r = banReason.trim();
                  if (r.length < 10) { notify.warning("Motivo muito curto"); return; }
                  banMut.mutate(r);
                }}
                disabled={banMut.isPending}
                className="rv-btn h-8 px-4 text-xs bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 disabled:opacity-40"
              >
                {banMut.isPending ? <Spinner /> : "Confirmar ban"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create Modal ───────────────────────────────────────────────────────────────

function CreateModal({ isOpen, onClose, groupList, isSuperuser, onRefresh }: {
  isOpen: boolean; onClose: () => void; groupList: string[]; isSuperuser: boolean; onRefresh: () => void;
}) {
  const [email, setEmail] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [isStaff, setIsStaff] = React.useState(false);
  const [groups, setGroups] = React.useState<string[]>([]);
  const [show, setShow] = React.useState(false);

  const reset = () => {
    setEmail(""); setUsername(""); setDisplayName(""); setPassword(""); setConfirm("");
    setIsStaff(false); setGroups([]);
  };

  const mismatch = confirm.length > 0 && password !== confirm;

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/accounts-admin/users/", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), username: username.trim(), display_name: displayName.trim() || null, password, is_staff: isStaff, groups }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        const msg = Object.values(body).flat().join(" ");
        throw new Error(msg || `Erro ${res.status}`);
      }
    },
    onSuccess: () => { onRefresh(); onClose(); reset(); notify.success("Usuário criado"); },
    onError: (e: Error) => notify.error("Falha ao criar", e.message),
  });

  const validate = () => {
    if (!email.trim()) { notify.warning("Informe o e-mail"); return false; }
    if (!username.trim() || username.trim().length < 3) { notify.warning("Usuário precisa de mínimo 3 caracteres"); return false; }
    if (!password) { notify.warning("Informe a senha"); return false; }
    if (password.length < 8) { notify.warning("Senha muito curta", "Mínimo 8 caracteres"); return false; }
    if (password !== confirm) { notify.warning("Senhas não conferem"); return false; }
    return true;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
      <div className="rv-card w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[var(--rv-border)]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[var(--rv-accent)]/20 border border-[var(--rv-accent)]/30 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-[var(--rv-accent)]" />
            </div>
            <p className="rv-display text-sm text-[var(--rv-text-primary)]">Criar usuário</p>
          </div>
          <button onClick={() => { onClose(); reset(); }} className="h-8 w-8 rounded-xl border border-[var(--rv-border)] flex items-center justify-center text-[var(--rv-text-dim)] hover:text-white transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[var(--rv-text-muted)] rv-label">E-mail *</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="email@dominio.com" className="rv-input h-9 text-xs" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[var(--rv-text-muted)] rv-label">Usuário * (mín. 3)</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" className="rv-input h-9 text-xs" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[var(--rv-text-muted)] rv-label">Nome de exibição</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Opcional" className="rv-input h-9 text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[var(--rv-text-muted)] rv-label">Senha * (mín. 8)</label>
              <div className="relative">
                <input value={password} onChange={(e) => setPassword(e.target.value)} type={show ? "text" : "password"} className="rv-input h-9 text-xs w-full pr-10" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--rv-text-dim)]">
                  {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[var(--rv-text-muted)] rv-label">Confirmar senha</label>
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type={show ? "text" : "password"} className={`rv-input h-9 text-xs ${mismatch ? "border-red-500/50" : ""}`} />
            </div>
          </div>
          {mismatch && <p className="text-[10px] text-red-400 -mt-2">Senhas não conferem.</p>}

          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-[var(--rv-text-muted)] rv-label">Nível de acesso</label>
            <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${isStaff ? "border-[var(--rv-accent)]/40 bg-[var(--rv-accent)]/10" : "border-[var(--rv-border)]"}`}>
              <div className={`h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isStaff ? "border-[var(--rv-accent)] bg-[var(--rv-accent)]" : "border-[var(--rv-border)]"}`}>
                {isStaff && <CheckCircle className="h-3 w-3 text-white" />}
              </div>
              <input type="checkbox" className="sr-only" checked={isStaff} onChange={(e) => setIsStaff(e.target.checked)} />
              <span className="text-xs text-[var(--rv-text-primary)]">Administrador (is_staff)</span>
            </label>
          </div>

          {groupList.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-[var(--rv-text-muted)] rv-label">Grupos</label>
              <div className="grid grid-cols-2 gap-2">
                {groupList.map((g) => {
                  const checked = groups.includes(g);
                  const locked = g === "admins" && !isSuperuser;
                  return (
                    <label key={g} className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${checked ? "border-[var(--rv-accent)]/40 bg-[var(--rv-accent)]/10" : "border-[var(--rv-border)]"} ${locked ? "opacity-40 cursor-not-allowed" : ""}`}>
                      <div className={`h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${checked ? "border-[var(--rv-accent)] bg-[var(--rv-accent)]" : "border-[var(--rv-border)]"}`}>
                        {checked && <CheckCircle className="h-3 w-3 text-white" />}
                      </div>
                      <input type="checkbox" className="sr-only" checked={checked} disabled={locked}
                        onChange={() => { if (locked) return; setGroups((p) => checked ? p.filter((x) => x !== g) : [...p, g]); }} />
                      <span className="text-xs text-[var(--rv-text-primary)]">{GROUP_LABELS[g] ?? g}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={() => { if (validate()) createMut.mutate(); }}
              disabled={createMut.isPending || mismatch}
              className="rv-btn rv-btn-primary h-9 px-6 text-xs flex items-center gap-2 disabled:opacity-40"
            >
              {createMut.isPending ? <Spinner /> : <><UserPlus className="h-3.5 w-3.5" /> Criar usuário</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export function UserAdminPanel() {
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const u = (user ?? null) as Record<string, unknown> | null;
  const isSuperuser = Boolean(u?.is_superuser) && !authLoading;
  const isAdmin = isSuperuser;
  const currentUserId = React.useMemo(() => {
    const v = u?.id;
    return typeof v === "string" || typeof v === "number" ? String(v) : null;
  }, [u]);

  // Filters
  const [mode, setMode] = React.useState<"all" | "banned">("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive">("all");
  const [staffFilter, setStaffFilter] = React.useState<"all" | "staff" | "nonstaff">("all");
  const [groupFilter, setGroupFilter] = React.useState("");
  const [ordering, setOrdering] = React.useState("-date_joined");

  // Modal state
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);

  const openEdit = (id: string) => { setSelectedUserId(id); setEditOpen(true); };
  const closeEdit = () => { setEditOpen(false); setSelectedUserId(null); };

  const { data: usersData, isLoading: isUsersLoading } = useQuery({
    queryKey: ["admin-users", mode, page, pageSize, debouncedSearch, statusFilter, staffFilter, groupFilter, ordering],
    enabled: isAdmin,
    queryFn: async ({ signal }) => {
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      qs.set("page_size", String(pageSize));
      if (ordering) qs.set("ordering", ordering);
      if (statusFilter === "active") qs.set("is_active", "true");
      if (statusFilter === "inactive") qs.set("is_active", "false");
      if (staffFilter === "staff") qs.set("is_staff", "true");
      if (staffFilter === "nonstaff") qs.set("is_staff", "false");
      if (groupFilter.trim()) qs.set("group", groupFilter.trim());
      if (mode === "banned") qs.set("is_banned", "true");

      const path = debouncedSearch.trim().length > 0
        ? `/api/accounts-admin/users/search/?q=${encodeURIComponent(debouncedSearch.trim())}&${qs}`
        : mode === "banned"
          ? `/api/accounts-admin/users/banned/?${qs}`
          : `/api/accounts-admin/users/?${qs}`;

      const res = await fetch(path, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parsePaginated<UserListItem>(await res.json());
    },
  });

  const { data: groupList = [] } = useQuery({
    queryKey: ["admin-user-groups"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await fetch("/api/accounts-admin/users/groups/");
      if (!res.ok) throw new Error();
      const body = await res.json() as { results?: string[] };
      return Array.isArray(body?.results) ? body.results : [];
    },
  });

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  const invalidateUser = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    queryClient.invalidateQueries({ queryKey: ["admin-user", selectedUserId] });
    queryClient.invalidateQueries({ queryKey: ["admin-audit", selectedUserId] });
  };

  const rows = usersData?.results ?? [];
  const canPrev = Boolean(usersData?.previous) && page > 1;
  const canNext = Boolean(usersData?.next);
  const totalCount = usersData?.count ?? 0;

  if (!authLoading && !isAdmin) {
    return (
      <div className="rv-card p-10 text-center">
        <ShieldOff className="h-10 w-10 text-[var(--rv-text-dim)] mx-auto mb-3 opacity-40" />
        <p className="text-sm text-[var(--rv-text-muted)]">Acesso restrito a superusuários.</p>
      </div>
    );
  }

  const filterCount = [statusFilter !== "all", staffFilter !== "all", groupFilter !== ""].filter(Boolean).length;

  return (
    <>
      <div className="flex flex-col gap-5">

        {/* ── Toolbar ── */}
        <div className="rv-card p-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--rv-text-dim)]" />
              <input
                value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }}
                placeholder="Buscar por e-mail, usuário ou nome..."
                className="rv-input h-10 pl-10 pr-10 text-xs w-full"
              />
              {search && (
                <button onClick={() => { setSearch(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--rv-text-dim)] hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Mode pills */}
            <div className="flex gap-1 bg-[var(--rv-surface-2)]/40 p-1 rounded-xl border border-[var(--rv-border)] self-start sm:self-auto">
              {(["all", "banned"] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); setPage(1); }}
                  className={`h-8 px-4 rounded-lg text-[10px] rv-label transition-all ${mode === m ? "bg-[var(--rv-accent)]/20 border border-[var(--rv-accent)]/40 text-[var(--rv-accent)]" : "text-[var(--rv-text-dim)] hover:text-[var(--rv-text-muted)]"}`}>
                  {m === "all" ? "Todos" : "Banidos"}
                </button>
              ))}
            </div>

            {/* Create button */}
            <button onClick={() => setCreateOpen(true)}
              className="rv-btn rv-btn-primary h-10 px-5 text-xs flex items-center gap-2 self-start sm:self-auto">
              <UserPlus className="h-4 w-4" /> Novo usuário
            </button>
          </div>

          {/* Secondary filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value as "all" | "active" | "inactive"); }}
              className="h-8 rounded-xl border border-[var(--rv-border)] bg-[var(--rv-surface-2)] px-3 text-[10px] text-[var(--rv-text-primary)] outline-none rv-label">
              <option value="all">Status: todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>

            <select value={staffFilter} onChange={(e) => { setPage(1); setStaffFilter(e.target.value as "all" | "staff" | "nonstaff"); }}
              className="h-8 rounded-xl border border-[var(--rv-border)] bg-[var(--rv-surface-2)] px-3 text-[10px] text-[var(--rv-text-primary)] outline-none rv-label">
              <option value="all">Admin: todos</option>
              <option value="staff">Admin: sim</option>
              <option value="nonstaff">Admin: não</option>
            </select>

            <select value={groupFilter} onChange={(e) => { setPage(1); setGroupFilter(e.target.value); }}
              className="h-8 rounded-xl border border-[var(--rv-border)] bg-[var(--rv-surface-2)] px-3 text-[10px] text-[var(--rv-text-primary)] outline-none rv-label">
              <option value="">Grupo: todos</option>
              {groupList.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>

            <select value={ordering} onChange={(e) => { setPage(1); setOrdering(e.target.value); }}
              className="h-8 rounded-xl border border-[var(--rv-border)] bg-[var(--rv-surface-2)] px-3 text-[10px] text-[var(--rv-text-primary)] outline-none rv-label">
              <option value="-date_joined">Mais novos</option>
              <option value="date_joined">Mais antigos</option>
              <option value="email">E-mail A→Z</option>
              <option value="-last_login">Último login</option>
            </select>

            {filterCount > 0 && (
              <button onClick={() => { setStatusFilter("all"); setStaffFilter("all"); setGroupFilter(""); setPage(1); }}
                className="rv-btn rv-btn-ghost h-8 px-3 text-[10px] flex items-center gap-1.5">
                <X className="h-3 w-3" /> Limpar filtros ({filterCount})
              </button>
            )}

            <div className="ml-auto rv-label text-[9px] text-[var(--rv-text-dim)]">
              {totalCount > 0 ? <>{rows.length} de {totalCount} usuários</> : "—"}
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="rv-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-[var(--rv-border)]">
                  {["USUÁRIO", "NOME", "GRUPOS", "STATUS", "CRIADO EM", "AÇÕES"].map((h) => (
                    <th key={h} className="px-4 py-3 rv-label text-[9px] text-[var(--rv-text-dim)] tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rv-border)]">
                {isUsersLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <Spinner />
                        <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">CARREGANDO...</span>
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <Users className="h-8 w-8 text-[var(--rv-text-dim)] mx-auto mb-3 opacity-30" />
                      <p className="text-sm text-[var(--rv-text-muted)]">Nenhum usuário encontrado.</p>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="group hover:bg-white/[0.015] transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-xs text-[var(--rv-text-primary)] font-medium truncate max-w-[160px]">{row.email}</p>
                        <p className="text-[10px] text-[var(--rv-text-dim)]">@{row.username}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-[var(--rv-text-muted)] truncate max-w-[120px]">{row.display_name || "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                          {row.is_superuser && <span className="rv-badge rv-badge-gold text-[8px]">superuser</span>}
                          {row.is_staff && !row.is_superuser && <span className="rv-badge rv-badge-purple text-[8px]">staff</span>}
                          {(row.groups ?? []).map((g) => (
                            <span key={g} className="rv-badge text-[8px]">{GROUP_LABELS[g] ?? g}</span>
                          ))}
                          {!row.is_superuser && !row.is_staff && (row.groups ?? []).length === 0 && (
                            <span className="text-[10px] text-[var(--rv-text-dim)]">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {row.is_active
                            ? <span className="rv-badge rv-badge-cyan text-[8px] w-fit">Ativo</span>
                            : <span className="rv-badge rv-badge-red text-[8px] w-fit">Inativo</span>}
                          {row.is_banned && <span className="rv-badge rv-badge-red text-[8px] w-fit">Banido</span>}
                          {row.is_verified && <span className="rv-badge text-[8px] w-fit">Verificado</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-[10px] text-[var(--rv-text-dim)]">{fmtDate(row.date_joined)}</p>
                        {row.last_login && (
                          <p className="text-[9px] text-[var(--rv-text-dim)] opacity-60">{fmtDateTime(row.last_login)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEdit(row.id)}
                          className="rv-btn rv-btn-ghost h-7 px-4 text-[10px] rv-label"
                        >
                          Gerenciar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {(canPrev || canNext) && (
            <div className="px-4 py-3 border-t border-[var(--rv-border)] flex items-center justify-between bg-white/[0.01]">
              <div className="flex items-center gap-2">
                <select value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}
                  className="h-7 rounded-lg border border-[var(--rv-border)] bg-[var(--rv-surface-2)] px-2 text-[10px] text-[var(--rv-text-primary)] outline-none rv-label">
                  <option value="20">20 / pág.</option>
                  <option value="50">50 / pág.</option>
                  <option value="100">100 / pág.</option>
                </select>
                <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">Página {page}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!canPrev}
                  className="rv-btn rv-btn-ghost h-7 px-3 text-[10px] flex items-center gap-1 disabled:opacity-30">
                  <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                </button>
                <button onClick={() => setPage((p) => p + 1)} disabled={!canNext}
                  className="rv-btn rv-btn-ghost h-7 px-3 text-[10px] flex items-center gap-1 disabled:opacity-30">
                  Próxima <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals (rendered once, outside the loop) ── */}
      <EditModal
        userId={selectedUserId} isOpen={editOpen} onClose={closeEdit}
        groupList={groupList} isSuperuser={isSuperuser} currentUserId={currentUserId}
        onRefresh={invalidateUser}
      />
      <CreateModal
        isOpen={createOpen} onClose={() => setCreateOpen(false)}
        groupList={groupList} isSuperuser={isSuperuser} onRefresh={invalidateUsers}
      />
    </>
  );
}
