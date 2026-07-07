"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { useDebounce } from "@/hooks/use-debounce";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type AuditUserRef = {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
};

type AdminAuditEvent = {
  id: string;
  created_at: string;
  action: string;
  actor: AuditUserRef | null;
  target: AuditUserRef;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string;
};

function parsePaginated<T>(body: unknown): Paginated<T> {
  if (Array.isArray(body)) {
    return { count: body.length, next: null, previous: null, results: body as T[] };
  }
  if (body && typeof body === "object") {
    const b = body as { count?: unknown; next?: unknown; previous?: unknown; results?: unknown };
    if (Array.isArray(b.results)) {
      return {
        count: typeof b.count === "number" ? b.count : b.results.length,
        next: typeof b.next === "string" ? b.next : null,
        previous: typeof b.previous === "string" ? b.previous : null,
        results: b.results as T[],
      };
    }
  }
  return { count: 0, next: null, previous: null, results: [] };
}

const ACTION_LABELS: Record<string, string> = {
  create_user: "Criar usuário",
  register_user: "Cadastro",
  email_verify_sent: "Enviar verificação",
  email_verified: "E-mail verificado",
  password_reset_sent: "Enviar reset",
  password_reset_confirmed: "Confirmar reset",
  activate: "Ativar",
  deactivate: "Desativar",
  ban: "Banir",
  unban: "Remover ban",
  reset_password: "Resetar senha",
  change_groups: "Trocar grupos",
  update_user: "Atualizar usuário",
  admin_verified: "Verificar (admin)",
};

const ACTION_BADGE: Record<string, string> = {
  ban: "rv-badge-red",
  unban: "rv-badge-cyan",
  deactivate: "rv-badge-red",
  activate: "rv-badge-cyan",
  reset_password: "rv-badge-gold",
  change_groups: "rv-badge-purple",
  create_user: "rv-badge-purple",
  register_user: "rv-badge-cyan",
  email_verified: "rv-badge-cyan",
  admin_verified: "rv-badge-gold",
};

function formatWhen(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("pt-BR");
}

function formatDetails(ev: AdminAuditEvent): string {
  const md = ev.metadata;
  if (!md || typeof md !== "object") return "";
  const m = md as Record<string, unknown>;

  if (ev.action === "email_verify_sent" && typeof m.resend === "boolean") {
    return m.resend ? "Reenvio" : "Primeiro envio";
  }
  if (ev.action === "ban" && typeof m.reason === "string") {
    return `Motivo: ${m.reason}`;
  }
  if (ev.action === "change_groups") {
    const from = Array.isArray(m.from) ? m.from.filter((x) => typeof x === "string").join(", ") : "";
    const to = Array.isArray(m.to) ? m.to.filter((x) => typeof x === "string").join(", ") : "";
    if (from || to) return `${from || "—"} → ${to || "—"}`;
  }
  if (ev.action === "update_user" && m.changes && typeof m.changes === "object") {
    const keys = Object.keys(m.changes as Record<string, unknown>);
    if (keys.length > 0) return `Campos: ${keys.join(", ")}`;
  }
  return "";
}

const ACTION_OPTIONS = Object.entries(ACTION_LABELS);

export function AuditEventsPanel() {
  const { user, isLoading: authLoading } = useAuth();
  const u = (user ?? null) as Record<string, unknown> | null;
  const isAdmin = Boolean(u?.is_admin || u?.is_superuser) && !authLoading;

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [q, setQ] = React.useState("");
  const debouncedQ = useDebounce(q, 400);
  const [action, setAction] = React.useState("");
  const [targetId, setTargetId] = React.useState("");
  const [ordering, setOrdering] = React.useState("-created_at");

  const queryKey = React.useMemo(
    () => ["admin-audit-events", page, pageSize, debouncedQ, action, targetId, ordering],
    [page, pageSize, debouncedQ, action, targetId, ordering]
  );

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: isAdmin,
    queryFn: async ({ signal }) => {
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      qs.set("page_size", String(pageSize));
      if (ordering) qs.set("ordering", ordering);
      if (debouncedQ.trim()) qs.set("q", debouncedQ.trim());
      if (action.trim()) qs.set("action", action.trim());
      if (targetId.trim()) qs.set("target", targetId.trim());
      const res = await fetch(`/api/accounts-admin/audit-events/?${qs.toString()}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parsePaginated<AdminAuditEvent>(await res.json());
    },
  });

  const rows = data?.results ?? [];
  const totalPages = data ? Math.ceil(data.count / pageSize) : 1;

  if (!authLoading && !isAdmin) {
    return (
      <div className="rv-card p-6 text-center text-sm text-[var(--rv-text-muted)]">
        Você não tem permissão para acessar esta área.
      </div>
    );
  }

  const selectCls = "h-9 rounded-xl border border-[var(--rv-border)] bg-[var(--rv-surface-2)] px-3 text-xs text-[var(--rv-text-primary)] outline-none focus:border-[var(--rv-accent)] transition-colors";

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="rv-card p-4 flex flex-col gap-3">
        {/* Row 1 */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--rv-text-dim)]" />
            <input
              value={q}
              onChange={(e) => { setPage(1); setQ(e.target.value); }}
              placeholder="Buscar por e-mail / usuário..."
              className="rv-input h-9 pl-9 text-xs w-full"
            />
          </div>
          <select
            value={action}
            onChange={(e) => { setPage(1); setAction(e.target.value); }}
            className={selectCls}
          >
            <option value="">Ação: todas</option>
            {ACTION_OPTIONS.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <select
            value={ordering}
            onChange={(e) => { setPage(1); setOrdering(e.target.value); }}
            className={selectCls}
          >
            <option value="-created_at">Mais recentes</option>
            <option value="created_at">Mais antigas</option>
            <option value="action">Ação (A-Z)</option>
          </select>
        </div>
        {/* Row 2 */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={targetId}
            onChange={(e) => { setPage(1); setTargetId(e.target.value); }}
            placeholder="Alvo (UUID, e-mail ou usuário)..."
            className="rv-input h-9 text-xs w-48"
          />
          {(q || action || targetId) && (
            <button
              onClick={() => { setPage(1); setQ(""); setAction(""); setTargetId(""); }}
              className="rv-btn rv-btn-ghost h-9 px-3 text-xs text-[var(--rv-text-dim)]"
            >
              Limpar filtros
            </button>
          )}
          <span className="ml-auto rv-label text-[9px] text-[var(--rv-text-dim)]">
            {data ? `${data.count} eventos` : "—"}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="rv-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-[var(--rv-border)]">
                {["QUANDO", "AÇÃO", "POR", "ALVO", "DETALHES", "IP"].map((h) => (
                  <th key={h} className="px-5 py-3 rv-label text-[9px] text-[var(--rv-text-dim)] tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rv-border)]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <div className="h-5 w-5 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
                      <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">CARREGANDO...</span>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-xs text-[var(--rv-text-muted)]">
                    Nenhum evento encontrado.
                  </td>
                </tr>
              ) : rows.map((ev) => {
                const actionLabel = ACTION_LABELS[ev.action] ?? ev.action;
                const badgeCls = ACTION_BADGE[ev.action] ?? "rv-badge-purple";
                const actorLabel = ev.actor ? (ev.actor.email) : "Sistema";
                const targetLabel = ev.target?.email ?? "—";
                const details = formatDetails(ev);
                return (
                  <tr key={ev.id} className="hover:bg-white/[0.015] transition-colors">
                    <td className="px-5 py-3 text-[10px] text-[var(--rv-text-dim)] whitespace-nowrap" suppressHydrationWarning>
                      {formatWhen(ev.created_at)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className={`rv-badge text-[9px] ${badgeCls}`}>{actionLabel}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--rv-text-muted)] whitespace-nowrap">{actorLabel}</td>
                    <td className="px-5 py-3 text-xs text-[var(--rv-text-muted)] whitespace-nowrap">{targetLabel}</td>
                    <td className="px-5 py-3 text-[10px] text-[var(--rv-text-dim)] max-w-[200px] truncate">{details || "—"}</td>
                    <td className="px-5 py-3 text-[10px] text-[var(--rv-text-dim)] whitespace-nowrap font-mono">{ev.ip_address || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-3 bg-white/[0.02] border-t border-[var(--rv-border)] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPage(1); setPageSize(Number.parseInt(e.target.value, 10)); }}
              className={`${selectCls} h-7`}
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">Página {page} / {totalPages || 1}</span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-7 w-7 rounded-lg border border-[var(--rv-border)] flex items-center justify-center text-[var(--rv-text-dim)] hover:bg-white/5 transition-all disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data?.next}
              className="h-7 w-7 rounded-lg border border-[var(--rv-border)] flex items-center justify-center text-[var(--rv-text-dim)] hover:bg-white/5 transition-all disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
