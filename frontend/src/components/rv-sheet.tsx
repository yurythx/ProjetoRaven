"use client";

import { useEffect, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
};

export function RvSheet({ open, onClose, title, description, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 bg-black/50 backdrop-blur-[2px] ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col rv-card rounded-none border-l border-[var(--rv-border)] transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="px-6 py-4 border-b border-[var(--rv-border)] flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="rv-display text-sm text-[var(--rv-text-primary)]">{title}</h2>
            {description && <p className="text-xs text-[var(--rv-text-dim)] mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg border border-[var(--rv-border)] text-[var(--rv-text-dim)] hover:text-white hover:border-[var(--rv-accent)] transition-all flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </>
  );
}
