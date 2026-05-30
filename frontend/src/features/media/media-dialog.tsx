"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fixImageUrl } from "@/lib/utils";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const ALLOWED_EXT = ".jpg, .jpeg, .png, .webp, .gif, .avif";

type MediaItem = {
  id: string;
  url: string;
  alt_text: string;
  original_filename: string;
  created_at: string;
};

export function MediaDialog({
  onSelect,
  trigger,
}: {
  onSelect: (url: string) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"gallery" | "upload" | "url">("gallery");
  const [url, setUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSelect = useMemo(() => url.trim().length > 5, [url]);

  const loadGallery = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/media/files", { method: "GET", headers: { Accept: "application/json" } });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError("Não foi possível carregar a galeria."); return; }
      const results: MediaItem[] = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data) ? data : [];
      setItems(results);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadGallery();
  }, [open, loadGallery]);

  function close(selectedUrl: string) {
    onSelect(selectedUrl);
    setOpen(false);
    setUrl("");
    setAltText("");
  }

  function validateFile(file: File): string | null {
    if (!ALLOWED_MIME.has(file.type)) {
      return `Formato não suportado. Use: ${ALLOWED_EXT}.`;
    }
    if (file.size > MAX_FILE_BYTES) {
      return `Arquivo muito grande. Tamanho máximo: ${MAX_FILE_BYTES / 1024 / 1024} MB.`;
    }
    return null;
  }

  async function upload(file: File) {
    const validationError = validateFile(file);
    if (validationError) { setError(validationError); return; }

    setError(null);
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      if (altText.trim()) form.append("alt_text", altText.trim());
      const res = await fetch("/api/media/files", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.image?.[0] ?? data?.error ?? "Falha ao enviar imagem.";
        setError(typeof msg === "string" ? msg : "Falha ao enviar imagem.");
        return;
      }
      const mediaUrl = typeof data?.url === "string" ? data.url : null;
      if (!mediaUrl) { setError("Upload concluído, mas não retornou URL."); return; }
      close(mediaUrl);
    } finally {
      setIsUploading(false);
    }
  }

  async function deleteItem(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/media/files/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        setError("Não foi possível deletar a imagem.");
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  const tabCls = (t: typeof tab) =>
    `px-4 py-1.5 text-xs rounded-lg transition-colors ${
      tab === t
        ? "bg-[var(--rv-accent)] text-white"
        : "text-[var(--rv-text-muted)] hover:text-white hover:bg-white/5"
    }`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Biblioteca de Mídia</DialogTitle>
          <DialogDescription>Envie ou selecione uma imagem para o conteúdo.</DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[var(--rv-border)] pb-2 mb-3">
          <button className={tabCls("gallery")} onClick={() => setTab("gallery")}>Galeria</button>
          <button className={tabCls("upload")} onClick={() => setTab("upload")}>Upload</button>
          <button className={tabCls("url")} onClick={() => setTab("url")}>URL</button>
        </div>

        {error && <p className="text-sm text-red-500 mb-2" role="alert">{error}</p>}

        {/* Gallery tab */}
        {tab === "gallery" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--rv-text-dim)]">
                {items.length} imagem{items.length !== 1 ? "ns" : ""}
              </span>
              <button
                onClick={loadGallery}
                className="text-xs text-[var(--rv-accent)] hover:underline"
                disabled={isLoading}
                aria-label="Recarregar galeria"
              >
                Recarregar
              </button>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-xl bg-[var(--rv-surface-2)] animate-pulse" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center text-[var(--rv-text-dim)] text-sm">
                Nenhuma imagem na galeria ainda.{" "}
                <button className="text-[var(--rv-accent)] hover:underline" onClick={() => setTab("upload")}>
                  Envie uma agora.
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[45dvh] sm:max-h-80 overflow-y-auto pr-1">
                {items.map((it) => (
                  <div key={it.id} className="group relative overflow-hidden rounded-xl border border-[var(--rv-border)] bg-[var(--rv-surface-2)] hover:border-[var(--rv-accent)] transition-colors">
                    <button
                      type="button"
                      title={it.original_filename || it.alt_text || it.id}
                      onClick={() => close(it.url)}
                      className="block w-full"
                    >
                      <Image
                        src={fixImageUrl(it.url) ?? ""}
                        alt={it.alt_text || ""}
                        width={400}
                        height={280}
                        sizes="25vw"
                        unoptimized
                        className="h-28 w-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    </button>
                    <button
                      type="button"
                      aria-label="Deletar imagem"
                      disabled={deletingId === it.id}
                      onClick={() => deleteItem(it.id)}
                      className="absolute top-1 right-1 h-6 w-6 rounded-lg bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upload tab */}
        {tab === "upload" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[var(--rv-text-dim)] block mb-1">
                Texto alternativo <span className="opacity-60">(opcional)</span>
              </label>
              <Input value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="Descrição da imagem…" />
            </div>
            <div>
              <label className="text-xs text-[var(--rv-text-dim)] block mb-1">
                Arquivo <span className="opacity-60">— máx. 10 MB · {ALLOWED_EXT}</span>
              </label>
              <input
                type="file"
                accept={ALLOWED_EXT}
                disabled={isUploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
                className="block w-full text-sm text-[var(--rv-text-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:bg-[var(--rv-accent)] file:text-white file:cursor-pointer hover:file:opacity-80 disabled:opacity-50"
              />
            </div>
            {isUploading && <p className="text-xs text-[var(--rv-text-dim)] animate-pulse">Enviando…</p>}
          </div>
        )}

        {/* URL tab */}
        {tab === "url" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                onKeyDown={(e) => { if (e.key === "Enter" && canSelect) close(url.trim()); }}
              />
              <Button type="button" disabled={!canSelect} onClick={() => close(url.trim())}>
                Inserir
              </Button>
            </div>
            <p className="text-xs text-[var(--rv-text-dim)]">
              Cole a URL de uma imagem externa. Imagens externas não passam pelo proxy e dependem da CSP do servidor.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
