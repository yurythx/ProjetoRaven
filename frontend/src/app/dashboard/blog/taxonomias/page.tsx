"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { ConfirmDialog } from "@/components/rv-confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, X, Check } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  display_order?: number;
  is_active?: boolean;
  post_count?: number;
};

type Tag = {
  id: string;
  name: string;
  slug: string;
};

type Tab = "categories" | "tags";

// ─── Slug util ────────────────────────────────────────────────────────────────

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Guard ────────────────────────────────────────────────────────────────────

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

// ─── Inline form ──────────────────────────────────────────────────────────────

function InlineForm({
  type,
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  type: Tab;
  initial?: { name: string; slug: string; description?: string; display_order?: number; is_active?: boolean };
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugManual, setSlugManual] = useState(Boolean(initial?.slug));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [displayOrder, setDisplayOrder] = useState(String(initial?.display_order ?? 0));
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugManual) setSlug(toSlug(v));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, unknown> = { name, slug };
    if (type === "categories") {
      data.description = description;
      data.display_order = Number(displayOrder) || 0;
      data.is_active = isActive;
    }
    onSave(data);
  };

  return (
    <form onSubmit={handleSubmit} className="rv-card p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="rv-label-field text-[10px]">Nome</label>
          <input
            className="rv-input bg-[var(--rv-surface-2)] h-9 text-sm"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Nome"
            required
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="rv-label-field text-[10px]">Slug</label>
            <button
              type="button"
              className="text-[10px] text-[var(--rv-accent)] hover:underline"
              onClick={() => setSlugManual((v) => !v)}
            >
              {slugManual ? "auto" : "editar"}
            </button>
          </div>
          <input
            className={`rv-input bg-[var(--rv-surface-2)] h-9 text-sm font-mono ${!slugManual ? "opacity-60" : ""}`}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            readOnly={!slugManual}
            placeholder="slug"
            required
          />
        </div>
      </div>

      {type === "categories" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="rv-label-field text-[10px]">Descrição</label>
            <input
              className="rv-input bg-[var(--rv-surface-2)] h-9 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="flex items-end gap-4">
            <div>
              <label className="rv-label-field text-[10px]">Ordem</label>
              <input
                type="number"
                className="rv-input bg-[var(--rv-surface-2)] h-9 text-sm w-20"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                min={0}
              />
            </div>
            <button
              type="button"
              onClick={() => setIsActive((v) => !v)}
              className={`flex items-center gap-2 h-9 px-3 rounded-xl border text-xs transition-all ${
                isActive
                  ? "border-green-500/40 bg-green-500/10 text-green-400"
                  : "border-[var(--rv-border)] text-[var(--rv-text-muted)]"
              }`}
            >
              {isActive ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              {isActive ? "Ativa" : "Inativa"}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={isPending} className="rv-btn rv-btn-primary h-8 px-4 text-xs disabled:opacity-50">
          {isPending ? "Salvando..." : "Salvar"}
        </button>
        <button type="button" onClick={onCancel} className="rv-btn rv-btn-ghost h-8 px-3 text-xs">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── Categories panel ─────────────────────────────────────────────────────────

function CategoriesPanel() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["blog-categories-admin"],
    queryFn: async () => {
      const res = await fetch("/api/blog-admin/categories/?ordering=display_order,name&page_size=200");
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json() as Category[] | { results: Category[] };
      return Array.isArray(data) ? data : (data.results ?? []);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/blog-admin/categories/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-categories-admin"] });
      setCreating(false);
      toast.success("Categoria criada");
    },
    onError: () => toast.error("Erro ao criar categoria"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/blog-admin/categories/${encodeURIComponent(id)}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-categories-admin"] });
      setEditingId(null);
      toast.success("Categoria atualizada");
    },
    onError: () => toast.error("Erro ao atualizar categoria"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/blog-admin/categories/${encodeURIComponent(id)}/`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-categories-admin"] });
      setDeleteTarget(null);
      toast.success("Categoria removida");
    },
    onError: () => toast.error("Erro ao remover categoria"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--rv-text-muted)]">{categories.length} categorias</p>
        <button
          onClick={() => { setCreating(true); setEditingId(null); }}
          className="rv-btn rv-btn-primary h-8 px-3 text-xs flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Nova Categoria
        </button>
      </div>

      {creating && (
        <InlineForm
          type="categories"
          onSave={(data) => createMutation.mutate(data)}
          onCancel={() => setCreating(false)}
          isPending={createMutation.isPending}
        />
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
        </div>
      )}

      <div className="space-y-2">
        {categories.map((cat) =>
          editingId === cat.id ? (
            <InlineForm
              key={cat.id}
              type="categories"
              initial={{ name: cat.name, slug: cat.slug, description: cat.description ?? "", display_order: cat.display_order, is_active: cat.is_active }}
              onSave={(data) => updateMutation.mutate({ id: cat.id, data })}
              onCancel={() => setEditingId(null)}
              isPending={updateMutation.isPending}
            />
          ) : (
            <div key={cat.id} className="rv-card px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[var(--rv-text-primary)]">{cat.name}</span>
                  <span className="text-[10px] text-[var(--rv-text-dim)] font-mono">{cat.slug}</span>
                  {typeof cat.post_count === "number" && (
                    <span className="rv-badge text-[9px]">{cat.post_count} posts</span>
                  )}
                  {cat.is_active === false && (
                    <span className="rv-badge text-[9px] opacity-50">inativa</span>
                  )}
                </div>
                {cat.description && (
                  <p className="text-xs text-[var(--rv-text-muted)] mt-0.5 truncate">{cat.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { setEditingId(cat.id); setCreating(false); }}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-[var(--rv-border)] hover:border-[var(--rv-accent)]/40 hover:bg-[var(--rv-accent)]/10 transition-colors"
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5 text-[var(--rv-text-muted)]" />
                </button>
                <button
                  onClick={() => setDeleteTarget(cat)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-[var(--rv-border)] hover:border-red-500/40 hover:bg-red-500/10 transition-colors"
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5 text-[var(--rv-text-muted)]" />
                </button>
              </div>
            </div>
          )
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remover categoria"
        description={`Remover "${deleteTarget?.name}"? Posts associados ficarão sem categoria.`}
        confirmLabel="Remover"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
      />
    </div>
  );
}

// ─── Tags panel ───────────────────────────────────────────────────────────────

function TagsPanel() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);

  const { data: tags = [], isLoading } = useQuery<Tag[]>({
    queryKey: ["blog-tags-admin"],
    queryFn: async () => {
      const res = await fetch("/api/blog-admin/tags/?ordering=name&page_size=500");
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json() as Tag[] | { results: Tag[] };
      return Array.isArray(data) ? data : (data.results ?? []);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/blog-admin/tags/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-tags-admin"] });
      setCreating(false);
      toast.success("Tag criada");
    },
    onError: () => toast.error("Erro ao criar tag"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/blog-admin/tags/${encodeURIComponent(id)}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-tags-admin"] });
      setEditingId(null);
      toast.success("Tag atualizada");
    },
    onError: () => toast.error("Erro ao atualizar tag"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/blog-admin/tags/${encodeURIComponent(id)}/`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-tags-admin"] });
      setDeleteTarget(null);
      toast.success("Tag removida");
    },
    onError: () => toast.error("Erro ao remover tag"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--rv-text-muted)]">{tags.length} tags</p>
        <button
          onClick={() => { setCreating(true); setEditingId(null); }}
          className="rv-btn rv-btn-primary h-8 px-3 text-xs flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Nova Tag
        </button>
      </div>

      {creating && (
        <InlineForm
          type="tags"
          onSave={(data) => createMutation.mutate(data)}
          onCancel={() => setCreating(false)}
          isPending={createMutation.isPending}
        />
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tags.map((tag) =>
          editingId === tag.id ? (
            <div key={tag.id} className="w-full">
              <InlineForm
                type="tags"
                initial={{ name: tag.name, slug: tag.slug }}
                onSave={(data) => updateMutation.mutate({ id: tag.id, data })}
                onCancel={() => setEditingId(null)}
                isPending={updateMutation.isPending}
              />
            </div>
          ) : (
            <div key={tag.id} className="flex items-center gap-1 h-8 px-3 rounded-full border border-[var(--rv-border)] bg-[var(--rv-surface)]">
              <span className="text-xs text-[var(--rv-text-primary)]">{tag.name}</span>
              <button
                onClick={() => { setEditingId(tag.id); setCreating(false); }}
                className="ml-1 h-5 w-5 flex items-center justify-center rounded-full hover:bg-[var(--rv-accent)]/10 transition-colors"
                title="Editar"
              >
                <Pencil className="h-3 w-3 text-[var(--rv-text-dim)]" />
              </button>
              <button
                onClick={() => setDeleteTarget(tag)}
                className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-red-500/10 transition-colors"
                title="Remover"
              >
                <X className="h-3 w-3 text-[var(--rv-text-dim)]" />
              </button>
            </div>
          )
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remover tag"
        description={`Remover "${deleteTarget?.name}"?`}
        confirmLabel="Remover"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TaxonomiasPage() {
  const [tab, setTab] = useState<Tab>("categories");

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-orb w-[400px] h-[400px] top-[5%] right-[-5%] bg-[var(--rv-accent)] opacity-[0.06]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-2 mb-8 rv-label text-[9px] text-[var(--rv-text-dim)]">
          <Link href="/dashboard" className="hover:text-[var(--rv-accent)] transition-colors">Dashboard</Link>
          <span>›</span>
          <Link href="/dashboard/blog" className="hover:text-[var(--rv-accent)] transition-colors">Blog</Link>
          <span>›</span>
          <span className="text-[var(--rv-text-muted)]">Taxonomias</span>
        </nav>

        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <span className="rv-badge rv-badge-purple">✦ Taxonomias</span>
            <h1 className="rv-display text-3xl text-[var(--rv-text-primary)]">Categorias &amp; Tags</h1>
          </div>
          <Link href="/dashboard/blog" className="rv-btn rv-btn-ghost h-9 px-4 text-xs">← Posts</Link>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-[var(--rv-border)]">
          {(["categories", "tags"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`h-9 px-5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-[var(--rv-accent)] text-[var(--rv-accent)]"
                  : "border-transparent text-[var(--rv-text-muted)] hover:text-[var(--rv-text-primary)]"
              }`}
            >
              {t === "categories" ? "Categorias" : "Tags"}
            </button>
          ))}
        </div>

        <Guard>
          {tab === "categories" ? <CategoriesPanel /> : <TagsPanel />}
        </Guard>
      </div>
    </div>
  );
}
