"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fixImageUrl } from "@/lib/utils";
import Link from "next/link";
import { RvModal } from "@/components/rv-modal";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/pjpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const ALLOWED_EXT = ".jpg, .jpeg, .png, .webp, .gif, .avif";
const ALLOWED_EXT_SET = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

type MediaItem = {
  id: string;
  url: string;
  alt_text: string;
  original_filename: string;
  width?: number | null;
  height?: number | null;
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
  const [search, setSearch] = useState("");
  const [altText, setAltText] = useState("");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inUse, setInUse] = useState<null | {
    cover_posts: Array<string | { slug: string; title?: string | null }>;
    content_posts: Array<string | { slug: string; title?: string | null }>;
    avatars: string[];
  }>(null);

  const canSelect = useMemo(() => url.trim().length > 5, [url]);

  const normalizeNextUrl = useCallback((value: string | null): string | null => {
    if (!value) return null;
    if (value.startsWith("http")) {
      const u = new URL(value);
      return `${u.pathname}${u.search}`.replace("/api/v1/media/files/", "/api/media/files");
    }
    return value.replace("/api/v1/media/files/", "/api/media/files");
  }, []);

  const fetchPage = useCallback(async (pageUrl: string) => {
    const res = await fetch(pageUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error("Não foi possível carregar a galeria.");
    const results: MediaItem[] = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data) ? data : [];
    const next = normalizeNextUrl(typeof data?.next === "string" ? data.next : null);
    const c = typeof data?.count === "number" ? data.count : null;
    return { results, next, count: c };
  }, [normalizeNextUrl]);

  const loadGallery = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("page_size", "24");
      if (search.trim()) qs.set("search", search.trim());
      const firstUrl = `/api/media/files?${qs.toString()}`;

      const page = await fetchPage(firstUrl);
      setItems(page.results);
      setNextUrl(page.next);
      setCount(page.count);
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, search]);

  const loadMore = useCallback(async () => {
    if (!nextUrl) return;
    setIsLoadingMore(true);
    try {
      const page = await fetchPage(nextUrl);
      setItems((prev) => [...prev, ...page.results]);
      setNextUrl(page.next);
      setCount(page.count);
    } catch {
      setError("Não foi possível carregar mais imagens.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchPage, nextUrl]);

  useEffect(() => {
    if (open) loadGallery();
  }, [open, loadGallery]);

  useEffect(() => {
    if (!open) return;
    if (tab !== "gallery") return;
    const t = window.setTimeout(() => { void loadGallery(); }, 250);
    return () => window.clearTimeout(t);
  }, [open, tab, search, loadGallery]);

  function close(selectedUrl: string) {
    onSelect(selectedUrl);
    setOpen(false);
    setUrl("");
    setAltText("");
  }

  function validateFile(file: File): string | null {
    const name = (file.name ?? "").toLowerCase();
    const hasAllowedExt = Array.from(ALLOWED_EXT_SET).some((ext) => name.endsWith(ext));
    const isAllowedMime = file.type ? ALLOWED_MIME.has(file.type) : false;
    if (!isAllowedMime && !hasAllowedExt) {
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
        const data = await res.json().catch(() => null);
        const msg = data?.detail ?? data?.error ?? "Não foi possível deletar a imagem.";
        const usedBy = data?.used_by as
          | {
              cover_posts?: Array<string | { slug: string; title?: string | null }>;
              content_posts?: Array<string | { slug: string; title?: string | null }>;
              avatars?: string[];
            }
          | undefined;
        if (usedBy) {
          setError(null);
          setInUse({
            cover_posts: Array.isArray(usedBy.cover_posts) ? usedBy.cover_posts : [],
            content_posts: Array.isArray(usedBy.content_posts) ? usedBy.content_posts : [],
            avatars: Array.isArray(usedBy.avatars) ? usedBy.avatars : [],
          });
          return;
        }
        setError(typeof msg === "string" ? msg : "Não foi possível deletar a imagem.");
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
    <>
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--rv-text-dim)]">
                  {typeof count === "number" ? `${count} itens` : `${items.length} itens`}
                </span>
                <button
                  onClick={loadGallery}
                  className="text-xs text-[var(--rv-accent)] hover:underline"
                  disabled={isLoading}
                  aria-label="Recarregar galeria"
                >
                  Atualizar
                </button>
              </div>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou alt…"
              />
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
              <div className="space-y-3">
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
                          width={it.width ?? 400}
                          height={it.height ?? 280}
                          sizes="25vw"
                          className="h-28 w-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </button>
                      {(it.width && it.height) && (
                        <div className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          {it.width}×{it.height}
                        </div>
                      )}
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

                {nextUrl && (
                  <div className="flex items-center justify-center">
                    <Button type="button" variant="secondary" onClick={loadMore} disabled={isLoadingMore}>
                      {isLoadingMore ? "Carregando..." : "Carregar mais"}
                    </Button>
                  </div>
                )}
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

      <RvModal
        open={!!inUse}
        onClose={() => setInUse(null)}
        title="Imagem em uso"
        description="Remova a referência antes de deletar este arquivo."
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <div className="text-sm text-[var(--rv-text-muted)]">
            Esta imagem está sendo usada nos itens abaixo.
          </div>

          {inUse?.cover_posts?.length ? (
            <div className="space-y-2">
              <div className="rv-label text-[9px] text-[var(--rv-text-dim)]">Capa</div>
              <div className="flex flex-wrap gap-2">
                {inUse.cover_posts.map((item) => {
                  const slug = typeof item === "string" ? item : item.slug;
                  const title = typeof item === "string" ? null : (item.title ?? null);
                  const label = title ? `${title}` : slug;
                  return (
                  <Link
                    key={slug}
                    href={`/blog/${encodeURIComponent(slug)}/editar`}
                    className="rv-btn rv-btn-ghost h-8 px-3 text-xs"
                    onClick={() => { setInUse(null); setOpen(false); }}
                  >
                    {label}
                  </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          {inUse?.content_posts?.length ? (
            <div className="space-y-2">
              <div className="rv-label text-[9px] text-[var(--rv-text-dim)]">Conteúdo</div>
              <div className="flex flex-wrap gap-2">
                {inUse.content_posts.map((item) => {
                  const slug = typeof item === "string" ? item : item.slug;
                  const title = typeof item === "string" ? null : (item.title ?? null);
                  const label = title ? `${title}` : slug;
                  return (
                  <Link
                    key={slug}
                    href={`/blog/${encodeURIComponent(slug)}/editar`}
                    className="rv-btn rv-btn-ghost h-8 px-3 text-xs"
                    onClick={() => { setInUse(null); setOpen(false); }}
                  >
                    {label}
                  </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          {inUse?.avatars?.length ? (
            <div className="space-y-2">
              <div className="rv-label text-[9px] text-[var(--rv-text-dim)]">Avatares</div>
              <div className="flex flex-wrap gap-2">
                {inUse.avatars.map((username) => (
                  <Link
                    key={username}
                    href={`/u/${encodeURIComponent(username)}`}
                    className="rv-btn rv-btn-ghost h-8 px-3 text-xs"
                    onClick={() => { setInUse(null); setOpen(false); }}
                  >
                    @{username}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <button className="rv-btn rv-btn-ghost h-9 px-4 text-xs" onClick={() => setInUse(null)}>
              Fechar
            </button>
          </div>
        </div>
      </RvModal>
    </>
  );
}
