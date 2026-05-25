"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";
import { notify } from "@/lib/notifications";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  post_count?: number;
};

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("/api/forum/categories?all=1");
  if (!res.ok) throw new Error("Falha ao carregar categorias.");
  const data = await res.json() as Category[] | { results?: Category[] };
  return Array.isArray(data) ? data : (data.results ?? []);
}

async function createCategory(body: Partial<Category>) {
  const res = await fetch("/api/forum/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(Object.values(err).flat().join(" ") || "Erro ao criar.");
  }
  return res.json();
}

async function updateCategory(slug: string, body: Partial<Category>) {
  const res = await fetch(`/api/forum/categories/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(Object.values(err).flat().join(" ") || "Erro ao atualizar.");
  }
  return res.json();
}

async function deleteCategory(slug: string) {
  const res = await fetch(`/api/forum/categories/${encodeURIComponent(slug)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error("Erro ao remover.");
}

export default function ForumCategoriesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const u = (user ?? null) as Record<string, unknown> | null;
  const canManage = Boolean(u?.is_admin || u?.is_forum_moderator || u?.is_staff || u?.is_superuser);

  const qc = useQueryClient();
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["forum-categories-admin"],
    queryFn: fetchCategories,
    enabled: canManage,
  });

  // New category form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showNew, setShowNew] = useState(false);

  // Inline edit
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editActive, setEditActive] = useState(true);

  const createMut = useMutation({
    mutationFn: () => createCategory({ name: newName.trim(), description: newDesc.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forum-categories-admin"] });
      notify.success("Categoria criada", "");
      setNewName(""); setNewDesc(""); setShowNew(false);
    },
    onError: (e: Error) => notify.error("Erro", e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ slug, body }: { slug: string; body: Partial<Category> }) => updateCategory(slug, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forum-categories-admin"] });
      notify.success("Categoria atualizada", "");
      setEditSlug(null);
    },
    onError: (e: Error) => notify.error("Erro", e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (slug: string) => deleteCategory(slug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forum-categories-admin"] });
      notify.success("Categoria removida", "");
    },
    onError: (e: Error) => notify.error("Erro", e.message),
  });

  function startEdit(cat: Category) {
    setEditSlug(cat.slug);
    setEditName(cat.name);
    setEditDesc(cat.description ?? "");
    setEditActive(cat.is_active);
  }

  if (authLoading) return null;

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4 text-center">
        <span className="text-5xl opacity-20">🔒</span>
        <h2 className="rv-display text-2xl text-[var(--rv-text-primary)]">Acesso restrito</h2>
        <p className="text-[var(--rv-text-muted)] text-sm">Apenas moderadores e administradores podem gerenciar categorias.</p>
        <Link href="/dashboard" className="rv-btn rv-btn-ghost h-10 px-6 text-xs">← Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto w-full max-w-4xl px-4 py-12">
      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard/forum" className="rv-label text-[9px] text-[var(--rv-text-dim)] hover:text-[var(--rv-accent)] transition-colors">Fórum</Link>
            <span className="text-[var(--rv-text-dim)]">›</span>
            <span className="rv-label text-[9px] text-[var(--rv-text-muted)]">Categorias</span>
          </div>
          <h1 className="rv-display text-3xl sm:text-4xl text-[var(--rv-text-primary)]">Categorias do Fórum</h1>
        </div>
        <button
          onClick={() => setShowNew(v => !v)}
          className="rv-btn rv-btn-primary h-10 px-4 text-xs flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nova
        </button>
      </div>

      {/* New category form */}
      {showNew && (
        <div className="rv-card p-6 mb-6 border border-[var(--rv-accent)]/30">
          <h3 className="rv-display text-lg text-[var(--rv-text-primary)] mb-4">Nova Categoria</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">Nome</label>
              <input className="rv-input" placeholder="Ex: Anúncios" value={newName} onChange={e => setNewName(e.target.value)} maxLength={100} />
            </div>
            <div>
              <label className="block text-xs text-[var(--rv-text-dim)] uppercase tracking-wider mb-1">Descrição</label>
              <input className="rv-input" placeholder="Descrição breve (opcional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} maxLength={300} />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowNew(false)} className="rv-btn rv-btn-ghost h-9 px-4 text-xs">Cancelar</button>
            <button
              onClick={() => createMut.mutate()}
              disabled={!newName.trim() || createMut.isPending}
              className="rv-btn rv-btn-primary h-9 px-4 text-xs disabled:opacity-50"
            >
              {createMut.isPending ? "Criando..." : "Criar Categoria"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rv-card animate-pulse" />)}
        </div>
      ) : categories.length === 0 ? (
        <div className="rv-card p-12 text-center">
          <p className="text-[var(--rv-text-muted)]">Nenhuma categoria encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map(cat => (
            <div key={cat.slug} className="rv-card p-4 sm:p-5">
              {editSlug === cat.slug ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input className="rv-input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome" />
                    <input className="rv-input" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Descrição" />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-[var(--rv-text-muted)] cursor-pointer">
                      <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)} className="h-4 w-4 rounded accent-[var(--rv-accent)]" />
                      Ativa
                    </label>
                    <div className="flex gap-2 ml-auto">
                      <button onClick={() => setEditSlug(null)} className="rv-btn rv-btn-ghost h-8 px-3 text-xs flex items-center gap-1">
                        <X className="h-3 w-3" /> Cancelar
                      </button>
                      <button
                        onClick={() => updateMut.mutate({ slug: cat.slug, body: { name: editName.trim(), description: editDesc.trim(), is_active: editActive } })}
                        disabled={!editName.trim() || updateMut.isPending}
                        className="rv-btn rv-btn-primary h-8 px-3 text-xs flex items-center gap-1 disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" /> {updateMut.isPending ? "..." : "Salvar"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-[var(--rv-text-primary)]">{cat.name}</span>
                      {!cat.is_active && <span className="rv-badge rv-badge-yellow text-[8px]">Inativa</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--rv-text-dim)]">
                      <span className="font-mono">/{cat.slug}</span>
                      {cat.description && <span className="truncate max-w-[200px] sm:max-w-xs">{cat.description}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link href={`/forum/c/${cat.slug}`} target="_blank" className="rv-btn rv-btn-ghost h-8 px-2 text-xs">↗</Link>
                    <button onClick={() => startEdit(cat)} className="rv-btn rv-btn-ghost h-8 px-2 text-xs flex items-center gap-1">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remover a categoria "${cat.name}"? Os tópicos existentes serão afetados.`)) {
                          deleteMut.mutate(cat.slug);
                        }
                      }}
                      disabled={deleteMut.isPending}
                      className="rv-btn rv-btn-ghost h-8 px-2 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
