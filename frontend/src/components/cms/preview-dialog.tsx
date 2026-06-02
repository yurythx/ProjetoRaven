"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, Monitor, Smartphone, X } from "lucide-react";

export function PreviewDialog({
  slug,
  href,
  trigger,
  defaultOpen = false,
}: {
  slug: string;
  href?: string;
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");

  const baseHref = useMemo(
    () => href ?? `/blog/${encodeURIComponent(slug)}`,
    [href, slug]
  );
  const iframeHref = useMemo(() => {
    const sep = baseHref.includes("?") ? "&" : "?";
    return `${baseHref}${sep}preview=1`;
  }, [baseHref]);

  // Fechar com Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      <span
        onClick={() => setOpen(true)}
        className="cursor-pointer inline-flex"
      >
        {trigger ?? (
          <button type="button" className="rv-btn rv-btn-ghost h-9 px-4 text-xs">
            Preview
          </button>
        )}
      </span>

      {open && (
        /* Overlay */
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          onClick={() => setOpen(false)}
          />
          {/* Modal card — stopPropagation para não fechar ao clicar dentro */}
          <div
            className="rv-card w-full flex flex-col overflow-hidden max-w-[1100px] max-h-[92vh] h-[92vh] relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-[var(--rv-border)]">
              {/* Lado esquerdo: título + slug */}
              <div className="flex items-center gap-3">
                <span className="rv-display text-sm text-[var(--rv-text-primary)]">Visualização</span>
                <code className="text-xs font-mono text-[var(--rv-accent)] bg-[var(--rv-surface-2)] px-2 py-0.5 rounded-lg border border-[var(--rv-border)]">
                  /{slug}
                </code>
              </div>

              {/* Lado direito: toggle + nova aba + fechar */}
              <div className="flex items-center gap-2">
                {/* Toggle desktop / mobile */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--rv-surface-2)] border border-[var(--rv-border)]">
                  <button
                    type="button"
                    className={`h-7 px-3 text-[11px] rounded-lg transition-all flex items-center gap-1.5 font-bold tracking-wide ${
                      viewMode === "desktop"
                        ? "bg-[var(--rv-accent)] text-white"
                        : "text-[var(--rv-text-muted)] hover:text-[var(--rv-text-primary)]"
                    }`}
                    onClick={() => setViewMode("desktop")}
                    aria-label="Visualizar em Desktop"
                  >
                    <Monitor className="h-3 w-3" aria-hidden="true" /> Desktop
                  </button>
                  <button
                    type="button"
                    className={`h-7 px-3 text-[11px] rounded-lg transition-all flex items-center gap-1.5 font-bold tracking-wide ${
                      viewMode === "mobile"
                        ? "bg-[var(--rv-accent)] text-white"
                        : "text-[var(--rv-text-muted)] hover:text-[var(--rv-text-primary)]"
                    }`}
                    onClick={() => setViewMode("mobile")}
                    aria-label="Visualizar em Mobile"
                  >
                    <Smartphone className="h-3 w-3" aria-hidden="true" /> Mobile
                  </button>
                </div>

                {/* Abrir em nova aba */}
                <Link
                  href={baseHref}
                  target="_blank"
                  rel="noreferrer"
                  className="rv-btn rv-btn-ghost flex items-center gap-1.5 text-[11px] h-8 px-3"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Nova Aba
                </Link>

                {/* Fechar */}
                <button
                  type="button"
                  aria-label="Fechar preview"
                  onClick={() => setOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-xl border border-[var(--rv-border)] hover:border-[var(--rv-accent)]/50 hover:bg-[var(--rv-accent)]/10 transition-colors text-[var(--rv-text-muted)] hover:text-[var(--rv-text-primary)]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Área do iframe */}
            {viewMode === "desktop" ? (
              <div className="flex-1 overflow-hidden bg-[var(--rv-surface-2)]">
                <iframe
                  key="desktop"
                  src={iframeHref}
                  className="w-full h-full border-0"
                  title="Preview Desktop"
                />
              </div>
            ) : (
              <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-[var(--rv-surface-2)]">
                <div className="w-[375px] h-[667px] rounded-[3rem] border-[8px] border-slate-800 overflow-hidden shrink-0 bg-white">
                  <iframe
                    key="mobile"
                    src={iframeHref}
                    className="w-full h-full border-0"
                    title="Preview Mobile"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
