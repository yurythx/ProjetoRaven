"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";

type CategoryItem = { id: string; name: string; slug: string; post_count?: number };
type TagItem = { id: string; name: string; slug: string };

function slugify(str: string) {
  return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function useIsAdmin() {
  const { user, isLoading } = useAuth();
  const u = (user ?? null) as Record<string, unknown> | null;
  return Boolean(u?.is_admin || u?.is_blog_editor || u?.is_staff || u?.is_superuser) && !isLoading;
}

// ── Category CRUD section ──────────────────────────────────────────────────────

function CategoriesTab({
  initial,
  isAdmin,
  currentCategory,
  buildHref,
}: {
  initial: CategoryItem[];
  isAdmin: boolean;
  currentCategory: string;
  buildHref: (ov: Record<string, string>) => string;
}) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<CategoryItem | null>(null);

  const { data: cats } = useQuery<CategoryItem[]>({
    queryKey: ["blog-categories"],
    queryFn: async () => {
      const res = await fetch("/api/blog-admin/categories/");
      if (!res.ok) throw new Error();
      const json = await res.json() as CategoryItem[] | { results: CategoryItem[] };
      return Array.isArray(json) ? json : (json.results ?? []);
    },
    initialData: initial,
    enabled: isAdmin,
  });

  const sorted = useMemo(
    () => [...(cats ?? initial)].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [cats, initial],
  );
  const existingSlugs = useMemo(() => new Set(sorted.map((c) => c.slug)), [sorted]);
  const isDup = !!newName.trim() && existingSlugs.has(slugify(newName.trim()));
  const tooShort = newName.trim().length > 0 && newName.trim().length < 2;

  const inv = () => qc.invalidateQueries({ queryKey: ["blog-categories"] });

  const createMut = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/blog-admin/categories/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slugify(name.trim()) }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { setNewName(""); inv(); },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/blog-admin/categories/${encodeURIComponent(id)}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slugify(name.trim()) }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { setEditing(null); inv(); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/blog-admin/categories/${encodeURIComponent(id)}/`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { setConfirmDel(null); inv(); },
  });

  return (
    <div className="flex flex-col gap-3">
      {isAdmin && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (!isDup && !tooShort && newName.trim()) createMut.mutate(newName); }}
          className="flex gap-2"
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nova categoria..."
            className="rv-input h-8 text-xs flex-1"
          />
          <button
            type="submit"
            disabled={!newName.trim() || isDup || tooShort || createMut.isPending}
            className="rv-btn rv-btn-primary h-8 px-3 text-xs disabled:opacity-40"
          >
            {createMut.isPending ? "…" : "+"}
          </button>
        </form>
      )}
      {(isDup || tooShort) && (
        <p className="text-[10px] text-red-400 -mt-1">{tooShort ? "Mínimo 2 caracteres." : "Já existe."}</p>
      )}

      <div className="space-y-1">
        <Link
          href={buildHref({ category: "", tag: "" })}
          className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${
            !currentCategory
              ? "bg-[var(--rv-accent-glow)] text-[var(--rv-accent)]"
              : "text-[var(--rv-text-muted)] hover:bg-white/5 hover:text-white"
          }`}
        >
          <span className="text-[10px]">Tudo</span>
        </Link>

        {sorted.map((cat) => (
          <div key={cat.id}>
            {isAdmin && editing?.id === cat.id ? (
              <div className="flex items-center gap-1 px-1 py-1">
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ id: cat.id, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updateMut.mutate({ id: cat.id, name: editing.name });
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="rv-input h-7 text-xs flex-1"
                  autoFocus
                />
                <button
                  onClick={() => updateMut.mutate({ id: cat.id, name: editing.name })}
                  disabled={updateMut.isPending}
                  className="rv-btn rv-btn-primary h-7 px-2 text-[10px] disabled:opacity-40"
                >✓</button>
                <button onClick={() => setEditing(null)} className="rv-btn rv-btn-ghost h-7 px-2 text-[10px]">✕</button>
              </div>
            ) : (
              <div className={`group flex items-center justify-between p-2.5 rounded-xl transition-all ${
                currentCategory === cat.slug
                  ? "bg-[var(--rv-accent-glow)] text-[var(--rv-accent)]"
                  : "text-[var(--rv-text-muted)] hover:bg-white/5 hover:text-white"
              }`}>
                <Link href={buildHref({ category: cat.slug, tag: "" })} className="flex-1 text-[10px] truncate">
                  {cat.name}
                </Link>
                <div className="flex items-center gap-1">
                  {cat.post_count !== undefined && (
                    <span className="text-[9px] opacity-50 mr-1">{cat.post_count}</span>
                  )}
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditing({ id: cat.id, name: cat.name })}
                        className="h-5 w-5 rounded flex items-center justify-center text-[9px] opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-[var(--rv-accent)] transition-all"
                        title="Editar"
                      >✏</button>
                      <button
                        type="button"
                        onClick={() => setConfirmDel(cat)}
                        className="h-5 w-5 rounded flex items-center justify-center text-[9px] opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-400 transition-all"
                        title="Remover"
                      >✕</button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="rv-card p-6 max-w-xs w-full flex flex-col gap-4">
            <p className="text-sm text-[var(--rv-text-primary)] font-semibold">
              Remover <span className="text-[var(--rv-accent)]">&ldquo;{confirmDel.name}&rdquo;</span>?
            </p>
            <p className="text-xs text-[var(--rv-text-dim)]">Posts associados perderão a categoria.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDel(null)} className="rv-btn rv-btn-ghost h-8 px-4 text-xs">Cancelar</button>
              <button
                onClick={() => deleteMut.mutate(confirmDel.id)}
                disabled={deleteMut.isPending}
                className="rv-btn h-8 px-4 text-xs bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-40"
              >
                {deleteMut.isPending ? "…" : "Remover"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tags CRUD section ──────────────────────────────────────────────────────────

function TagsTab({
  initial,
  isAdmin,
  currentTag,
  buildHref,
}: {
  initial: TagItem[];
  isAdmin: boolean;
  currentTag: string;
  buildHref: (ov: Record<string, string>) => string;
}) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<TagItem | null>(null);

  const { data: tags } = useQuery<TagItem[]>({
    queryKey: ["blog-tags"],
    queryFn: async () => {
      const res = await fetch("/api/blog-admin/tags/");
      if (!res.ok) throw new Error();
      const json = await res.json() as TagItem[] | { results: TagItem[] };
      return Array.isArray(json) ? json : (json.results ?? []);
    },
    initialData: initial,
    enabled: isAdmin,
  });

  const sorted = useMemo(
    () => [...(tags ?? initial)].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [tags, initial],
  );
  const existingSlugs = useMemo(() => new Set(sorted.map((t) => t.slug)), [sorted]);
  const isDup = !!newName.trim() && existingSlugs.has(slugify(newName.trim()));
  const tooShort = newName.trim().length > 0 && newName.trim().length < 2;

  const inv = () => qc.invalidateQueries({ queryKey: ["blog-tags"] });

  const createMut = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/blog-admin/tags/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slugify(name.trim()) }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { setNewName(""); inv(); },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/blog-admin/tags/${encodeURIComponent(id)}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slugify(name.trim()) }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { setEditing(null); inv(); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/blog-admin/tags/${encodeURIComponent(id)}/`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { setConfirmDel(null); inv(); },
  });

  return (
    <div className="flex flex-col gap-3">
      {isAdmin && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (!isDup && !tooShort && newName.trim()) createMut.mutate(newName); }}
          className="flex gap-2"
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nova tag..."
            className="rv-input h-8 text-xs flex-1"
          />
          <button
            type="submit"
            disabled={!newName.trim() || isDup || tooShort || createMut.isPending}
            className="rv-btn rv-btn-primary h-8 px-3 text-xs disabled:opacity-40"
          >
            {createMut.isPending ? "…" : "+"}
          </button>
        </form>
      )}
      {(isDup || tooShort) && (
        <p className="text-[10px] text-red-400 -mt-1">{tooShort ? "Mínimo 2 caracteres." : "Já existe."}</p>
      )}

      {sorted.length === 0 ? (
        <p className="text-[10px] text-[var(--rv-text-dim)] text-center py-4">Nenhuma tag ainda.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {sorted.map((tag) => (
            <div key={tag.id}>
              {isAdmin && editing?.id === tag.id ? (
                <div className="flex items-center gap-1">
                  <input
                    value={editing.name}
                    onChange={(e) => setEditing({ id: tag.id, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") updateMut.mutate({ id: tag.id, name: editing.name });
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="rv-input h-7 text-xs w-24"
                    autoFocus
                  />
                  <button
                    onClick={() => updateMut.mutate({ id: tag.id, name: editing.name })}
                    disabled={updateMut.isPending}
                    className="rv-btn rv-btn-primary h-7 px-2 text-[10px] disabled:opacity-40"
                  >✓</button>
                  <button onClick={() => setEditing(null)} className="rv-btn rv-btn-ghost h-7 px-2 text-[10px]">✕</button>
                </div>
              ) : (
                <div className={`group flex items-center gap-0.5 rv-badge transition-all ${
                  currentTag === tag.slug ? "rv-badge-cyan" : "rv-badge-purple"
                } pl-2.5 pr-1 py-0`}>
                  <Link href={buildHref({ tag: currentTag === tag.slug ? "" : tag.slug, category: "" })} className="text-[10px]">
                    #{tag.name}
                  </Link>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditing({ id: tag.id, name: tag.name })}
                        className="h-4 w-4 rounded flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:text-white transition-all"
                        title="Editar"
                      >✏</button>
                      <button
                        type="button"
                        onClick={() => setConfirmDel(tag)}
                        className="h-4 w-4 rounded flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:text-red-400 transition-all"
                        title="Remover"
                      >✕</button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="rv-card p-6 max-w-xs w-full flex flex-col gap-4">
            <p className="text-sm text-[var(--rv-text-primary)] font-semibold">
              Remover tag <span className="text-[var(--rv-accent)]">&ldquo;{confirmDel.name}&rdquo;</span>?
            </p>
            <p className="text-xs text-[var(--rv-text-dim)]">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDel(null)} className="rv-btn rv-btn-ghost h-8 px-4 text-xs">Cancelar</button>
              <button
                onClick={() => deleteMut.mutate(confirmDel.id)}
                disabled={deleteMut.isPending}
                className="rv-btn h-8 px-4 text-xs bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-40"
              >
                {deleteMut.isPending ? "…" : "Remover"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function BlogSidebarTaxonomy({
  initialCategories,
  initialTags,
}: {
  initialCategories: CategoryItem[];
  initialTags: TagItem[];
}) {
  const isAdmin = useIsAdmin();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category") ?? "";
  const currentTag = searchParams.get("tag") ?? "";

  const buildHref = (overrides: Record<string, string>) => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("page");
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === "") p.delete(k);
      else p.set(k, v);
    });
    const s = p.toString();
    return `/blog${s ? `?${s}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Categorias ── */}
      <div className="rv-card p-5 flex flex-col gap-3">
        <h3 className="rv-display text-sm text-[var(--rv-text-primary)] flex items-center gap-2">
          <span className="text-[var(--rv-accent)]">◈</span> Categorias
        </h3>
        <CategoriesTab
          initial={initialCategories}
          isAdmin={isAdmin}
          currentCategory={currentCategory}
          buildHref={buildHref}
        />
      </div>

      {/* ── Tags ── */}
      <div className="rv-card p-5 flex flex-col gap-3">
        <h3 className="rv-display text-sm text-[var(--rv-text-primary)] flex items-center gap-2">
          <span className="text-[var(--rv-cyan)]">#</span> Tags
        </h3>
        <TagsTab
          initial={initialTags}
          isAdmin={isAdmin}
          currentTag={currentTag}
          buildHref={buildHref}
        />
      </div>
    </div>
  );
}
