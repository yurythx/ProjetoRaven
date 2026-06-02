"use client";

import { useEffect, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidth?: string;
};

export function RvModal({ open, onClose, title, description, children, maxWidth = "max-w-lg" }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`rv-card w-full ${maxWidth} flex flex-col max-h-[90dvh] overflow-hidden`}>
        <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-[var(--rv-border)] flex-shrink-0">
          <h2 className="rv-display text-base text-[var(--rv-text-primary)]">{title}</h2>
          {description && <p className="text-xs text-[var(--rv-text-dim)] mt-1">{description}</p>}
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
