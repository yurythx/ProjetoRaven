"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ConfirmDialog } from "@/components/rv-confirm-dialog";
import { fixImageUrl } from "@/lib/utils";
import { Trash2, Upload, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

type MediaItem = {
  id: string;
  url: string;
  alt_text: string;
  original_filename: string;
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

  const loadGallery = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/media/files", { headers: { Accept: "application/json" } });
      const data = await res.json().catch(() => null);
      if (!res.ok) { toast.error("Erro ao carregar galeria"); return; }
      const results: MediaItem[] = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(results);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadGallery(); }, [loadGallery]);

  async function uploadFile(file: File) {
    if (!ALLOWED_MIME.has(file.type)) { toast.error("Tipo de arquivo não suportado"); return; }
    if (file.size > MAX_FILE_BYTES) { toast.error("Arquivo muito grande (máx 10 MB)"); return; }
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/media/files", { method: "POST", body: form });
      if (!res.ok) { toast.error("Erro ao fazer upload"); return; }
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
      if (!res.ok && res.status !== 204) { toast.error("Erro ao remover imagem"); return; }
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
        <p className="text-xs text-[var(--rv-text-muted)]">{items.length} imagens na biblioteca</p>
        <button onClick={loadGallery} className="text-xs text-[var(--rv-text-dim)] hover:text-[var(--rv-accent)] transition-colors">
          Atualizar
        </button>
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
                  unoptimized
                />
                {/* Overlay on hover */}
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
  );
}

export default function MediaLibraryPage() {
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="rv-orb"
          style={{ width: "400px", height: "400px", bottom: "5%", right: "-5%", background: "var(--rv-gold)", opacity: 0.05 }}
        />
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
