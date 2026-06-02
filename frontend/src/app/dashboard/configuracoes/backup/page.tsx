"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HardDrive, RefreshCw, ShieldAlert } from "lucide-react";
import { RvModal } from "@/components/rv-modal";
import { ConfirmDialog } from "@/components/rv-confirm-dialog";
import { notify } from "@/lib/notifications";

type BackupFileMeta = { name: string; size_bytes: number };

type BackupItem = {
  id: string;
  created_at: string;
  db: BackupFileMeta | null;
  media: BackupFileMeta | null;
};

type BackupListResponse = { items: BackupItem[] };

type BackupVerifyResponse = {
  id: string;
  created_at: string;
  ok: boolean;
  db: { name: string; exists: boolean; size_bytes: number; ok: boolean; error: string } | null;
  media: { name: string; exists: boolean; size_bytes: number; ok: boolean; entries: number; error: string } | null;
};

type BackupJobResponse = {
  id: string;
  kind: string;
  status: "pending" | "running" | "success" | "failed" | "cancelled";
  backup_id: string;
  include_media: boolean;
  wipe_media: boolean;
  keep_last: number | null;
  stage: string;
  cancel_requested: boolean;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  error: string;
  log: string;
  result: Record<string, unknown>;
};

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

type AuditUserRef = { id: string; email: string; username: string; display_name: string | null };

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

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const digits = i === 0 ? 0 : i <= 2 ? 1 : 2;
  return `${v.toFixed(digits)} ${units[i]}`;
}

export default function BackupsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-backups"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/accounts-admin/admin/backups/", { signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<BackupListResponse>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (include_media: boolean) => {
      const res = await fetch("/api/accounts-admin/admin/backups/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ include_media }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-backups"] });
      notify.success("Backup criado");
    },
    onError: (error: unknown) => notify.error("Falha ao criar backup", error),
  });

  const createJobMutation = useMutation({
    mutationFn: async (include_media: boolean) => {
      const res = await fetch("/api/accounts-admin/admin/backups/job/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ include_media }),
      });
      const txt = await res.text().catch(() => "");
      if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
      return JSON.parse(txt) as BackupJobResponse;
    },
    onSuccess: (job) => {
      setJobId(job.id);
      setJobOpen(true);
      notify.success("Backup em background iniciado");
    },
    onError: (error: unknown) => notify.error("Falha ao iniciar backup em background", error),
  });

  const pruneMutation = useMutation({
    mutationFn: async (keep_last: number) => {
      const res = await fetch("/api/accounts-admin/admin/backups/prune/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keep_last }),
      });
      const txt = await res.text().catch(() => "");
      if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
      return res.json() as Promise<{ deleted: string[]; kept: number }>;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-backups"] });
      notify.success(`Limpeza concluída (${data.deleted.length} removido(s))`);
    },
    onError: (error: unknown) => notify.error("Falha ao limpar backups antigos", error),
  });

  const pruneJobMutation = useMutation({
    mutationFn: async (keep_last: number) => {
      const res = await fetch("/api/accounts-admin/admin/backups/prune-job/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keep_last }),
      });
      const txt = await res.text().catch(() => "");
      if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
      return JSON.parse(txt) as BackupJobResponse;
    },
    onSuccess: async (job) => {
      setJobId(job.id);
      setJobOpen(true);
      notify.success("Limpeza em background iniciada");
      await queryClient.invalidateQueries({ queryKey: ["admin-backups"] });
    },
    onError: (error: unknown) => notify.error("Falha ao iniciar limpeza em background", error),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/accounts-admin/admin/backups/${encodeURIComponent(id)}/`, { method: "DELETE" });
      const txt = await res.text().catch(() => "");
      if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-backups"] });
      notify.success("Backup removido");
    },
    onError: (error: unknown) => notify.error("Falha ao remover backup", error),
  });

  const verifyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/accounts-admin/admin/backups/${encodeURIComponent(id)}/verify/`, { cache: "no-store" });
      const txt = await res.text().catch(() => "");
      if (!res.ok) {
        try {
          return JSON.parse(txt) as BackupVerifyResponse;
        } catch {
          throw new Error(txt || `HTTP ${res.status}`);
        }
      }
      return JSON.parse(txt) as BackupVerifyResponse;
    },
    onSuccess: (data) => {
      if (data.ok) notify.success("Backup verificado: OK");
      else notify.error("Backup com inconsistência", data);
    },
    onError: (error: unknown) => notify.error("Falha ao verificar backup", error),
  });

  const restoreMutation = useMutation({
    mutationFn: async (payload: { id: string; include_media: boolean; wipe_media: boolean; confirm: string }) => {
      const res = await fetch(`/api/accounts-admin/admin/backups/${encodeURIComponent(payload.id)}/restore/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          include_media: payload.include_media,
          wipe_media: payload.wipe_media,
          confirm: payload.confirm,
        }),
      });
      const txt = await res.text().catch(() => "");
      if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
    },
    onSuccess: () => notify.success("Restore concluído"),
    onError: (error: unknown) => notify.error("Falha no restore", error),
  });

  const restoreJobMutation = useMutation({
    mutationFn: async (payload: { id: string; include_media: boolean; wipe_media: boolean; confirm: string }) => {
      const res = await fetch(`/api/accounts-admin/admin/backups/${encodeURIComponent(payload.id)}/restore-job/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          include_media: payload.include_media,
          wipe_media: payload.wipe_media,
          confirm: payload.confirm,
        }),
      });
      const txt = await res.text().catch(() => "");
      if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
      return JSON.parse(txt) as BackupJobResponse;
    },
    onError: (error: unknown) => notify.error("Falha ao iniciar restore em background", error),
  });

  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/accounts-admin/admin/backup-jobs/${encodeURIComponent(jobId)}/cancel/`, { method: "POST" });
      const txt = await res.text().catch(() => "");
      if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
      return JSON.parse(txt) as BackupJobResponse;
    },
    onSuccess: () => {
      notify.success("Cancelamento solicitado");
    },
    onError: (error: unknown) => notify.error("Falha ao cancelar job", error),
  });

  const items = data?.items ?? [];

  const [restoreOpen, setRestoreOpen] = React.useState(false);
  const [restoreTarget, setRestoreTarget] = React.useState<BackupItem | null>(null);
  const [restoreIncludeMedia, setRestoreIncludeMedia] = React.useState(true);
  const [restoreWipeMedia, setRestoreWipeMedia] = React.useState(true);
  const [restoreConfirm, setRestoreConfirm] = React.useState("");

  const [keepLast, setKeepLast] = React.useState(20);
  const [deleteTarget, setDeleteTarget] = React.useState<BackupItem | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [verifyTarget, setVerifyTarget] = React.useState<BackupItem | null>(null);
  const [verifyOpen, setVerifyOpen] = React.useState(false);
  const [jobOpen, setJobOpen] = React.useState(false);
  const [jobId, setJobId] = React.useState<string | null>(null);

  const jobQuery = useQuery({
    queryKey: ["backup-job", jobId],
    enabled: Boolean(jobId),
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/accounts-admin/admin/backup-jobs/${encodeURIComponent(jobId ?? "")}/`, {
        signal,
        cache: "no-store",
      });
      const txt = await res.text().catch(() => "");
      if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
      return JSON.parse(txt) as BackupJobResponse;
    },
    refetchInterval: (q) => {
      const st = (q.state.data as BackupJobResponse | undefined)?.status;
      return st === "pending" || st === "running" ? 1500 : false;
    },
  });

  const auditQuery = useQuery({
    queryKey: ["backup-audit-events"],
    queryFn: async ({ signal }) => {
      const qs = new URLSearchParams({ page: "1", page_size: "20", ordering: "-created_at", action_prefix: "backup_" });
      const res = await fetch(`/api/accounts-admin/audit-events/?${qs.toString()}`, { signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as Paginated<AdminAuditEvent>;
    },
  });

  function openRestore(item: BackupItem) {
    setRestoreTarget(item);
    setRestoreIncludeMedia(Boolean(item.media));
    setRestoreWipeMedia(true);
    setRestoreConfirm("");
    setRestoreOpen(true);
  }

  function closeRestore() {
    if (restoreMutation.isPending) return;
    setRestoreOpen(false);
    setRestoreTarget(null);
  }

  const inputCls = "rv-input h-11 text-sm";
  const requiredConfirm = restoreTarget ? `RESTORE ${restoreTarget.id}` : "";

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16">
      <div className="space-y-4 mb-10">
        <span className="rv-badge rv-badge-gold">◈ Sistema</span>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h1 className="rv-display text-4xl sm:text-6xl text-[var(--rv-text-primary)] tracking-tight">
            Back<span className="text-[var(--rv-accent)]">ups</span>
          </h1>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rv-btn rv-btn-ghost h-9 px-4 text-xs gap-2 flex items-center disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
        <p className="text-sm text-[var(--rv-text-muted)] max-w-2xl flex items-center gap-2">
          <HardDrive className="h-4 w-4 flex-shrink-0" />
          Backup/restore do banco e da mídia (admin). O restore exige confirmação forte.
        </p>
      </div>

      <div className="rv-card p-6">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="rv-label text-[9px] text-[var(--rv-text-dim)]">AÇÕES</div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rv-btn h-9 px-4 text-xs bg-[var(--rv-accent)]/10 border border-[var(--rv-accent)]/30 text-[var(--rv-accent)] hover:bg-[var(--rv-accent)]/20 disabled:opacity-40"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate(true)}
              type="button"
            >
              {createMutation.isPending ? "…" : "Criar backup (DB + mídia)"}
            </button>
            <button
              className="rv-btn rv-btn-ghost h-9 px-4 text-xs disabled:opacity-40"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate(false)}
              type="button"
            >
              Criar backup (somente DB)
            </button>
            <button
              className="rv-btn h-9 px-4 text-xs bg-[var(--rv-gold)]/10 border border-[var(--rv-gold)]/30 text-[var(--rv-gold)] hover:bg-[var(--rv-gold)]/20 disabled:opacity-40"
              disabled={createJobMutation.isPending}
              onClick={() => createJobMutation.mutate(true)}
              type="button"
            >
              {createJobMutation.isPending ? "…" : "Backup (background) DB + mídia"}
            </button>
            <button
              className="rv-btn h-9 px-4 text-xs bg-[var(--rv-gold)]/10 border border-[var(--rv-gold)]/30 text-[var(--rv-gold)] hover:bg-[var(--rv-gold)]/20 disabled:opacity-40"
              disabled={createJobMutation.isPending}
              onClick={() => createJobMutation.mutate(false)}
              type="button"
            >
              Backup (background) só DB
            </button>
          </div>
        </div>

        <div className="rv-divider my-6 opacity-15" />

        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="rv-label text-[9px] text-[var(--rv-text-dim)]">RETENÇÃO</div>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              className="rv-input h-9 text-xs w-28"
              type="number"
              min={1}
              max={200}
              value={keepLast}
              onChange={(e) => setKeepLast(Number(e.target.value))}
            />
            <button
              type="button"
              disabled={pruneMutation.isPending}
              className="rv-btn h-9 px-4 text-xs bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-40"
              onClick={() => pruneMutation.mutate(Number.isFinite(keepLast) ? keepLast : 20)}
            >
              {pruneMutation.isPending ? "…" : "Manter últimos N (remover antigos)"}
            </button>
            <button
              type="button"
              disabled={pruneJobMutation.isPending}
              className="rv-btn h-9 px-4 text-xs bg-[var(--rv-gold)]/10 border border-[var(--rv-gold)]/30 text-[var(--rv-gold)] hover:bg-[var(--rv-gold)]/20 disabled:opacity-40"
              onClick={() => pruneJobMutation.mutate(Number.isFinite(keepLast) ? keepLast : 20)}
            >
              {pruneJobMutation.isPending ? "…" : "Limpar em background"}
            </button>
          </div>
        </div>

        <div className="rv-divider my-6 opacity-15" />

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-12">
            <div className="h-5 w-5 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
            <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">AGUARDANDO SERVIDOR...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--rv-text-muted)]">Nenhum backup encontrado.</div>
        ) : (
          <div className="space-y-3">
            {items.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-[var(--rv-border)] bg-[var(--rv-surface-2)]/20 p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="rv-display text-sm text-[var(--rv-text-primary)]">backup_{b.id}</div>
                    <div className="text-xs text-[var(--rv-text-dim)] mt-0.5">{formatDateTime(b.created_at)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {b.db ? (
                      <a
                        className="rv-btn rv-btn-ghost h-8 px-3 text-xs"
                        href={`/api/accounts-admin/admin/backups/${encodeURIComponent(b.id)}/download/?part=db`}
                      >
                        Baixar DB ({formatBytes(b.db.size_bytes)})
                      </a>
                    ) : null}
                    {b.media ? (
                      <a
                        className="rv-btn rv-btn-ghost h-8 px-3 text-xs"
                        href={`/api/accounts-admin/admin/backups/${encodeURIComponent(b.id)}/download/?part=media`}
                      >
                        Baixar mídia ({formatBytes(b.media.size_bytes)})
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openRestore(b)}
                      className="rv-btn h-8 px-3 text-xs bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20"
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVerifyTarget(b);
                        setVerifyOpen(true);
                        verifyMutation.mutate(b.id);
                      }}
                      className="rv-btn rv-btn-ghost h-8 px-3 text-xs"
                      disabled={verifyMutation.isPending}
                    >
                      {verifyMutation.isPending && verifyTarget?.id === b.id ? "Verificando…" : "Verificar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteTarget(b);
                        setDeleteOpen(true);
                      }}
                      className="rv-btn h-8 px-3 text-xs bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-[var(--rv-text-dim)] flex items-center gap-2">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Restore pode sobrescrever dados e apagar mídia atual.
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rv-divider my-6 opacity-15" />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="rv-label text-[9px] text-[var(--rv-text-dim)]">AUDITORIA (BACKUP)</div>
          <button
            type="button"
            className="rv-btn rv-btn-ghost h-8 px-3 text-xs"
            onClick={() => auditQuery.refetch()}
            disabled={auditQuery.isFetching}
          >
            Atualizar
          </button>
        </div>

        {auditQuery.isLoading ? (
          <div className="text-xs text-[var(--rv-text-dim)] py-4">Carregando...</div>
        ) : auditQuery.error ? (
          <div className="text-xs text-red-400 py-4">Falha ao carregar auditoria.</div>
        ) : (auditQuery.data?.results?.length ?? 0) === 0 ? (
          <div className="text-xs text-[var(--rv-text-dim)] py-4">Nenhum evento encontrado.</div>
        ) : (
          <div className="mt-3 flex flex-col divide-y divide-[var(--rv-border)]">
            {(auditQuery.data?.results ?? []).map((ev) => (
              <div key={ev.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rv-badge rv-badge-purple text-[8px]">{ev.action}</span>
                    {ev.actor?.email ? (
                      <span className="text-[10px] text-[var(--rv-text-dim)]">por {ev.actor.email}</span>
                    ) : null}
                    {typeof ev.metadata?.backup_id === "string" ? (
                      <span className="text-[10px] text-[var(--rv-text-dim)] font-mono">backup_{String(ev.metadata.backup_id)}</span>
                    ) : null}
                  </div>
                  <div className="text-[10px] text-[var(--rv-text-muted)] mt-0.5 break-words">
                    {ev.ip_address ? `IP: ${ev.ip_address}` : "IP: —"}{" "}
                    {ev.user_agent ? `• UA: ${ev.user_agent.slice(0, 60)}` : ""}
                  </div>
                </div>
                <span className="text-[10px] text-[var(--rv-text-dim)] whitespace-nowrap shrink-0" suppressHydrationWarning>
                  {formatDateTime(ev.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          if (deleteMutation.isPending) return;
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
        title={`Excluir backup_${deleteTarget?.id ?? ""}?`}
        description="Remove os arquivos do backup (DB e mídia) e o registro. Essa ação não afeta o banco atual."
        confirmLabel="Excluir"
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMutation.mutate(deleteTarget.id, {
            onSettled: () => {
              setDeleteOpen(false);
              setDeleteTarget(null);
            },
          });
        }}
        isPending={deleteMutation.isPending}
        variant="danger"
      />

      <RvModal
        open={verifyOpen}
        onClose={() => {
          if (verifyMutation.isPending) return;
          setVerifyOpen(false);
          setVerifyTarget(null);
        }}
        title={`Verificação — backup_${verifyTarget?.id ?? ""}`}
        description="Checagem de integridade dos arquivos do backup (não altera nada)."
        maxWidth="max-w-lg"
      >
        {verifyMutation.isPending ? (
          <div className="flex items-center justify-center gap-3 py-8">
            <div className="h-5 w-5 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
            <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">VERIFICANDO...</span>
          </div>
        ) : verifyMutation.data ? (
          <div className="space-y-4">
            <div
              className={`rounded-2xl border p-4 ${
                verifyMutation.data.ok
                  ? "border-[var(--rv-border)] bg-[var(--rv-surface-2)]/20"
                  : "border-red-500/30 bg-red-500/10"
              }`}
            >
              <div className="rv-display text-sm text-[var(--rv-text-primary)]">
                {verifyMutation.data.ok ? "OK" : "Inconsistência detectada"}
              </div>
              <div className="text-xs text-[var(--rv-text-dim)] mt-1">{formatDateTime(verifyMutation.data.created_at)}</div>
            </div>

            <pre className="whitespace-pre-wrap break-words text-xs text-[var(--rv-text-muted)] font-mono leading-relaxed">
              {JSON.stringify(verifyMutation.data, null, 2)}
            </pre>

            <div className="flex justify-end">
              <button
                type="button"
                className="rv-btn rv-btn-ghost h-9 px-4 text-xs"
                onClick={() => {
                  setVerifyOpen(false);
                  setVerifyTarget(null);
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-[var(--rv-text-muted)]">Nenhum resultado.</div>
        )}
      </RvModal>

      <RvModal
        open={restoreOpen}
        onClose={closeRestore}
        title={`Restore — backup_${restoreTarget?.id ?? ""}`}
        description="Essa operação sobrescreve o banco. Use apenas quando necessário."
        maxWidth="max-w-lg"
      >
        {!restoreTarget ? null : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="rv-label text-[9px] text-[var(--rv-text-dim)]">OPÇÕES</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRestoreIncludeMedia((v) => !v)}
                  className={`rv-btn h-8 px-3 text-xs ${
                    restoreIncludeMedia
                      ? "bg-[var(--rv-accent)]/10 border border-[var(--rv-accent)]/30 text-[var(--rv-accent)]"
                      : "rv-btn-ghost"
                  }`}
                  disabled={!restoreTarget.media}
                >
                  {restoreIncludeMedia ? "Restaurar mídia: sim" : "Restaurar mídia: não"}
                </button>
                <button
                  type="button"
                  onClick={() => setRestoreWipeMedia((v) => !v)}
                  className={`rv-btn h-8 px-3 text-xs ${
                    restoreWipeMedia
                      ? "bg-orange-500/10 border border-orange-500/30 text-orange-400"
                      : "rv-btn-ghost"
                  }`}
                  disabled={!restoreIncludeMedia || !restoreTarget.media}
                >
                  {restoreWipeMedia ? "Apagar mídia atual: sim" : "Apagar mídia atual: não"}
                </button>
              </div>
              {!restoreTarget.media ? (
                <div className="text-xs text-[var(--rv-text-dim)]">Este backup não possui mídia.</div>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="rv-label text-[9px] text-[var(--rv-text-dim)]">CONFIRMAÇÃO</div>
              <div className="text-xs text-[var(--rv-text-muted)]">
                Digite exatamente:{" "}
                <span className="font-mono text-[var(--rv-accent)] bg-[var(--rv-surface-2)] px-2 py-1 rounded border border-[var(--rv-border)]">
                  {requiredConfirm}
                </span>
              </div>
              <input
                className={inputCls}
                value={restoreConfirm}
                onChange={(e) => setRestoreConfirm(e.target.value)}
                placeholder={requiredConfirm}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="rv-btn rv-btn-ghost h-9 px-4 text-xs" onClick={closeRestore}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  restoreJobMutation.isPending ||
                  restoreConfirm.trim() !== requiredConfirm ||
                  restoreMutation.isPending
                }
                className="rv-btn h-9 px-4 text-xs bg-[var(--rv-accent)]/10 border border-[var(--rv-accent)]/30 text-[var(--rv-accent)] hover:bg-[var(--rv-accent)]/20 disabled:opacity-40"
                onClick={async () => {
                  if (!restoreTarget) return;
                  try {
                    const job = await restoreJobMutation.mutateAsync({
                      id: restoreTarget.id,
                      include_media: restoreIncludeMedia,
                      wipe_media: restoreWipeMedia,
                      confirm: restoreConfirm.trim(),
                    });
                    setJobId(job.id);
                    setJobOpen(true);
                    setRestoreOpen(false);
                    notify.success("Restore em background iniciado");
                  } catch {
                    return;
                  }
                }}
              >
                {restoreJobMutation.isPending ? "Iniciando…" : "Rodar em background"}
              </button>
              <button
                type="button"
                disabled={restoreMutation.isPending || restoreConfirm.trim() !== requiredConfirm}
                className="rv-btn h-9 px-4 text-xs bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-40"
                onClick={() => {
                  if (!restoreTarget) return;
                  restoreMutation.mutate({
                    id: restoreTarget.id,
                    include_media: restoreIncludeMedia,
                    wipe_media: restoreWipeMedia,
                    confirm: restoreConfirm.trim(),
                  });
                }}
              >
                {restoreMutation.isPending ? "Restaurando…" : "Confirmar restore"}
              </button>
            </div>
          </div>
        )}
      </RvModal>

      <RvModal
        open={jobOpen}
        onClose={() => {
          const st = jobQuery.data?.status;
          if (st === "pending" || st === "running") return;
          setJobOpen(false);
          setJobId(null);
        }}
        title={`Job — ${jobId ?? ""}`}
        description="Acompanhe o progresso do job (backup/restore). Ao finalizar, recarregue o site se necessário."
        maxWidth="max-w-2xl"
      >
        {!jobId ? (
          <div className="text-sm text-[var(--rv-text-muted)]">Nenhum job selecionado.</div>
        ) : jobQuery.isLoading ? (
          <div className="flex items-center justify-center gap-3 py-8">
            <div className="h-5 w-5 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
            <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">CARREGANDO...</span>
          </div>
        ) : jobQuery.error ? (
          <div className="text-sm text-red-400">Falha ao carregar job.</div>
        ) : jobQuery.data ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-[var(--rv-text-dim)]">
                Status:{" "}
                <span className="font-mono text-[var(--rv-accent)]">{jobQuery.data.status}</span>
                {jobQuery.data.stage ? (
                  <>
                    {" "}
                    <span className="text-[var(--rv-text-dim)]">•</span>{" "}
                    <span className="font-mono text-[var(--rv-text-muted)]">{jobQuery.data.stage}</span>
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {jobQuery.data.status === "pending" || jobQuery.data.status === "running" ? (
                  <button
                    type="button"
                    className="rv-btn h-8 px-3 text-xs bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-40"
                    onClick={async () => {
                      if (!jobId) return;
                      await cancelJobMutation.mutateAsync(jobId).catch(() => null);
                      await jobQuery.refetch();
                    }}
                    disabled={cancelJobMutation.isPending || jobQuery.data.cancel_requested}
                  >
                    {jobQuery.data.cancel_requested ? "Cancelamento solicitado" : cancelJobMutation.isPending ? "…" : "Cancelar"}
                  </button>
                ) : null}
                <button type="button" className="rv-btn rv-btn-ghost h-8 px-3 text-xs" onClick={() => jobQuery.refetch()}>
                  Atualizar
                </button>
              </div>
            </div>

            {jobQuery.data.error ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300 whitespace-pre-wrap break-words">
                {jobQuery.data.error}
              </div>
            ) : null}

            <pre className="whitespace-pre-wrap break-words text-xs text-[var(--rv-text-muted)] font-mono leading-relaxed max-h-[50dvh] overflow-y-auto rv-card p-4">
              {jobQuery.data.log || "(sem logs)"}
            </pre>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="rv-btn rv-btn-ghost h-9 px-4 text-xs"
                onClick={() => {
                  const st = jobQuery.data?.status;
                  if (st === "pending" || st === "running") return;
                  setJobOpen(false);
                  setJobId(null);
                }}
                disabled={jobQuery.data.status === "pending" || jobQuery.data.status === "running"}
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-[var(--rv-text-muted)]">Nenhum resultado.</div>
        )}
      </RvModal>
    </div>
  );
}
