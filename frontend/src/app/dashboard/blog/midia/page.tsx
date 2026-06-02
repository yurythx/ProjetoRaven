"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ConfirmDialog } from "@/components/rv-confirm-dialog";
import { RvModal } from "@/components/rv-modal";
import { fixImageUrl } from "@/lib/utils";
import { Trash2, Upload, Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/pjpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
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

function Guard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const u = (user ?? null) as Record<string, unknown> | null;
  const canAccess = Boolean(u?.is_admin || u?.is_blog_editor || u?.is_staff || u?.is_superuser);
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-8 w-8 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!canAccess) {
    return (
      <div className="text-center py-20">
        <span className="text-4xl block mb-4 opacity-20">🔒</span>
        <p className="text-[var(--rv-text-muted)] text-sm mb-6">Acesso restrito a editores e administradores.</p>
        <Link href="/dashboard" className="rv-btn rv-btn-ghost h-10 px-6 text-xs">← Dashboard</Link>
      </div>
    );
  }
  return <>{children}</>;
}

function MediaLibrary() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [search, setSearch] = useState("");
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [inUse, setInUse] = useState<null | {
    cover_posts: Array<string | { slug: string; title?: string | null }>;
    content_posts: Array<string | { slug: string; title?: string | null }>;
    avatars: string[];
  }>(null);

  const normalizeNextUrl = useCallback((value: string | null): string | null => {
    if (!value) return null;
    if (value.startsWith("http")) {
      const u = new URL(value);
      return `${u.pathname}${u.search}`.replace("/api/v1/media/files/", "/api/media/files");
    }
    return value.replace("/api/v1/media/files/", "/api/media/files");
  }, []);

  const fetchPage = useCallback(async (pageUrl: string) => {
    const res = await fetch(pageUrl, { headers: { Accept: "application/json" }, cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error("Erro ao carregar galeria");
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
    setIsLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("page_size", "30");
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

  useEffect(() => { void loadGallery(); }, [loadGallery]);

  const loadMore = useCallback(async () => {
    if (!nextUrl) return;
    setIsLoadingMore(true);
    try {
      const page = await fetchPage(nextUrl);
      setItems((prev) => [...prev, ...page.results]);
      setNextUrl(page.next);
      setCount(page.count);
    } catch {
      toast.error("Erro ao carregar mais");
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchPage, nextUrl]);

  async function uploadFile(file: File) {
    const name = (file.name ?? "").toLowerCase();
    const hasAllowedExt = Array.from(ALLOWED_EXT_SET).some((ext) => name.endsWith(ext));
    const isAllowedMime = file.type ? ALLOWED_MIME.has(file.type) : false;
    if (!isAllowedMime && !hasAllowedExt) { toast.error("Tipo de arquivo não suportado"); return; }
    if (file.size > MAX_FILE_BYTES) { toast.error("Arquivo muito grande (máx 10 MB)"); return; }
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/media/files", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.image?.[0] ?? data?.error ?? "Erro ao fazer upload";
        toast.error(typeof msg === "string" ? msg : "Erro ao fazer upload");
        return;
      }
      toast.success("Imagem enviada");
      await loadGallery();
    } finally {
      setIsUploading(false);
    }
  }

  async function deleteItem(item: MediaItem) {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/media/files/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => null);
        const msg = data?.detail ?? data?.error ?? "Erro ao remover imagem";
        const usedBy = data?.used_by as
          | {
              cover_posts?: Array<string | { slug: string; title?: string | null }>;
              content_posts?: Array<string | { slug: string; title?: string | null }>;
              avatars?: string[];
            }
          | undefined;
        if (usedBy) {
          setInUse({
            cover_posts: Array.isArray(usedBy.cover_posts) ? usedBy.cover_posts : [],
            content_posts: Array.isArray(usedBy.content_posts) ? usedBy.content_posts : [],
            avatars: Array.isArray(usedBy.avatars) ? usedBy.avatars : [],
          });
          return;
        }
        toast.error(typeof msg === "string" ? msg : "Erro ao remover imagem");
        return;
      }
      toast.success("Imagem removida");
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  }

  function copyUrl(item: MediaItem) {
    const url = fixImageUrl(item.url) || item.url;
    void navigator.clipboard.writeText(url);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  return (
    <>
    <div className="space-y-6">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-all ${
          dragOver
            ? "border-[var(--rv-accent)] bg-[var(--rv-accent)]/5"
            : "border-[var(--rv-border)] hover:border-[var(--rv-accent)]/40 hover:bg-[var(--rv-accent)]/3"
        }`}
      >
        <Upload className="h-8 w-8 text-[var(--rv-text-dim)] mb-3" />
        <p className="text-sm font-medium text-[var(--rv-text-primary)] mb-1">
          {isUploading ? "Enviando..." : "Arraste uma imagem ou clique para fazer upload"}
        </p>
        <p className="text-xs text-[var(--rv-text-muted)]">JPG, PNG, WebP, GIF, AVIF • Máx 10 MB</p>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.gif,.avif"
          onChange={handleFileInput}
          disabled={isUploading}
          className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--rv-text-muted)]">
          {typeof count === "number" ? `${count} imagens` : `${items.length} imagens`}
        </p>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="h-9 w-44 rounded-xl border border-[var(--rv-border)] bg-[var(--rv-surface)] px-3 text-xs text-[var(--rv-text-primary)] outline-none focus:border-[var(--rv-accent)]"
          />
          <button onClick={loadGallery} className="text-xs text-[var(--rv-text-dim)] hover:text-[var(--rv-accent)] transition-colors">
            Aplicar
          </button>
        </div>
      </div>

      {/* Gallery grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-4xl block mb-4 opacity-20">🖼️</span>
          <p className="text-sm text-[var(--rv-text-muted)]">Nenhuma imagem na biblioteca ainda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map((item) => {
              const url = fixImageUrl(item.url) || item.url;
              return (
                <div key={item.id} className="group relative aspect-square rounded-xl overflow-hidden border border-[var(--rv-border)] bg-[var(--rv-surface)]">
                  <Image
                    src={url}
                    alt={item.alt_text || item.original_filename}
                    fill
                    className="object-cover"
                  />
                  {(item.width && item.height) && (
                    <div className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.width}×{item.height}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                    <p className="text-[10px] text-white text-center leading-tight line-clamp-2 w-full">
                      {item.original_filename}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => copyUrl(item)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                        title="Copiar URL"
                      >
                        {copiedId === item.id
                          ? <Check className="h-3.5 w-3.5 text-green-400" />
                          : <Copy className="h-3.5 w-3.5 text-white" />
                        }
                      </button>
                      <button
                        onClick={() => setDeleteTarget(item)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg bg-red-500/30 hover:bg-red-500/50 transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {nextUrl && (
            <div className="flex items-center justify-center">
              <button
                type="button"
                className="rv-btn rv-btn-ghost h-10 px-6 text-xs"
                onClick={loadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Carregando..." : "Carregar mais"}
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remover imagem"
        description={`Remover "${deleteTarget?.original_filename}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
        variant="danger"
        isPending={isDeleting}
        onConfirm={() => { if (deleteTarget) void deleteItem(deleteTarget); }}
      />
    </div>

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
                  onClick={() => { setInUse(null); setDeleteTarget(null); }}
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
                  onClick={() => { setInUse(null); setDeleteTarget(null); }}
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
                  onClick={() => { setInUse(null); setDeleteTarget(null); }}
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

export default function MediaLibraryPage() {
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-orb w-[400px] h-[400px] bottom-[5%] right-[-5%] bg-[var(--rv-gold)] opacity-[0.05]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-2 mb-8 rv-label text-[9px] text-[var(--rv-text-dim)]">
          <Link href="/dashboard" className="hover:text-[var(--rv-accent)] transition-colors">Dashboard</Link>
          <span>›</span>
          <Link href="/dashboard/blog" className="hover:text-[var(--rv-accent)] transition-colors">Blog</Link>
          <span>›</span>
          <span className="text-[var(--rv-text-muted)]">Biblioteca de Mídia</span>
        </nav>

        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <span className="rv-badge rv-badge-gold">✦ Mídia</span>
            <h1 className="rv-display text-3xl text-[var(--rv-text-primary)]">Biblioteca de Mídia</h1>
          </div>
          <Link href="/dashboard/blog" className="rv-btn rv-btn-ghost h-9 px-4 text-xs">← Posts</Link>
        </div>

        <Guard>
          <MediaLibrary />
        </Guard>
      </div>
    </div>
  );
}
