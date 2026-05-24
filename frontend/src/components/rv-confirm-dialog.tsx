"use client";

import { RvModal } from "./rv-modal";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  isPending?: boolean;
  variant?: "danger" | "warning" | "default";
  children?: React.ReactNode;
};

export function ConfirmDialog({
  open, onClose, title, description,
  confirmLabel = "Confirmar", onConfirm, isPending,
  variant = "danger", children,
}: Props) {
  const confirmCls =
    variant === "danger"
      ? "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
      : variant === "warning"
      ? "bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20"
      : "bg-[var(--rv-accent)]/10 border border-[var(--rv-accent)]/30 text-[var(--rv-accent)] hover:bg-[var(--rv-accent)]/20";

  return (
    <RvModal open={open} onClose={onClose} title={title} description={description} maxWidth="max-w-sm">
      {children}
      <div className="flex gap-2 justify-end mt-2">
        <button
          onClick={onClose}
          disabled={isPending}
          className="rv-btn rv-btn-ghost h-8 px-4 text-xs"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          disabled={isPending}
          className={`rv-btn h-8 px-4 text-xs disabled:opacity-40 ${confirmCls}`}
        >
          {isPending ? "..." : confirmLabel}
        </button>
      </div>
    </RvModal>
  );
}
