"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { ForumRichEditor } from "@/components/forum-rich-editor";
import { slugify, stripHtml } from "@/lib/utils";

type ForumCategory = { id: string; name: string; slug: string; description?: string };

export function NewTopicClient({ initialCategorySlug }: { initialCategorySlug: string }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [categorySlug, setCategorySlug] = useState(initialCategorySlug);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCats, setIsLoadingCats] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/forum/categories?page=1&page_size=200`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        const results = (data?.results ?? []) as ForumCategory[];
        setCategories(results);
        setCategorySlug((prev) => prev || results[0]?.slug || "");
      } finally {
        setIsLoadingCats(false);
      }
    })();
  }, []);

  const u = (user ?? null) as Record<string, unknown> | null;
  const isVerified = Boolean(u?.is_verified);
  const isActive = u?.is_active === undefined ? true : Boolean(u?.is_active);
  const isBanned = Boolean(u?.is_banned);
  const canPost = isVerified && isActive && !isBanned;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="h-8 w-8 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  /* ── Not logged in ── */
  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="rv-badge rv-badge-red inline-flex">⚠ Acesso Negado</div>
        <h1 className="rv-display text-4xl text-[var(--rv-text-primary)]">Login Necessário</h1>
        <p className="text-[var(--rv-text-muted)] max-w-sm" style={{ fontFamily: "var(--font-body)" }}>
          Você precisa estar logado para criar um tópico.
        </p>
        <div className="flex gap-3">
          <Link href="/login" className="rv-btn rv-btn-primary px-8 h-11 text-xs">⚡ Entrar</Link>
          <Link href="/forum" className="rv-btn rv-btn-ghost px-8 h-11 text-xs">← Fórum</Link>
        </div>
      </div>
    );
  }

  /* ── Not allowed ── */
  if (!canPost) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="rv-badge rv-badge-purple inline-flex">🔒 Conta Restrita</div>
        <h1 className="rv-display text-4xl text-[var(--rv-text-primary)]">Conta Não Habilitada</h1>
        <p className="text-[var(--rv-text-muted)] max-w-sm" style={{ fontFamily: "var(--font-body)" }}>
          Sua conta precisa estar verificada e ativa para criar tópicos no fórum.
        </p>
        <div className="flex gap-3">
          <Link href="/me" className="rv-btn rv-btn-primary px-8 h-11 text-xs">Ver Perfil</Link>
          <Link href="/forum" className="rv-btn rv-btn-ghost px-8 h-11 text-xs">← Fórum</Link>
        </div>
      </div>
    );
  }

  const titleLen = title.trim().length;
  const contentLen = stripHtml(content).trim().length;

  /* ── Form ── */
  return (
    <div className="relative min-h-screen">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-orb rv-animate-pulse-glow" style={{ width: "450px", height: "450px", top: "-15%", right: "-10%", background: "var(--rv-cyan)", opacity: 0.15 }} />
        <div className="rv-orb" style={{ width: "350px", height: "350px", bottom: "5%", left: "-10%", background: "var(--rv-accent)", opacity: 0.12 }} />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-10 sm:py-16 sm:px-6">
        {/* Header */}
        <nav className="flex items-center gap-2 mb-8 rv-label text-[9px] text-[var(--rv-text-dim)]">
          <Link href="/forum" className="hover:text-[var(--rv-accent)] transition-colors">Fórum</Link>
          <span>›</span>
          {categorySlug && (
            <>
              <Link href={`/forum/c/${categorySlug}`} className="hover:text-[var(--rv-accent)] transition-colors">
                {categories.find((c) => c.slug === categorySlug)?.name ?? categorySlug}
              </Link>
              <span>›</span>
            </>
          )}
          <span className="text-[var(--rv-text-muted)]">Novo Tópico</span>
        </nav>

        <div className="mb-8">
          <span className="rv-badge rv-badge-cyan mb-4 inline-flex">◈ Criar Discussão</span>
          <h1 className="rv-display text-3xl sm:text-4xl text-[var(--rv-text-primary)]">Novo Tópico</h1>
          <p className="mt-2 text-sm text-[var(--rv-text-muted)]" style={{ fontFamily: "var(--font-body)" }}>
            Inicie uma discussão, tire dúvidas ou compartilhe algo com a comunidade.
          </p>
        </div>

        <form
          className="rv-card p-6 sm:p-8 flex flex-col gap-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            const categoryId = categories.find((c) => c.slug === categorySlug)?.id;
            if (!categoryId) { setError("Selecione uma categoria válida."); return; }
            const slug = slugify(title).slice(0, 80);
            if (!slug) { setError("Título inválido."); return; }
            if (contentLen < 10) { setError("Conteúdo muito curto (mínimo 10 caracteres)."); return; }
            setIsSubmitting(true);
            const res = await fetch("/api/forum/topics", {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ category: categoryId, title, slug, content }),
            });
            setIsSubmitting(false);
            const data = await res.json().catch(() => null);
            if (!res.ok) {
              setError(
                typeof data?.error === "string" ? data.error
                : typeof data?.detail === "string" ? data.detail
                : "Falha ao criar tópico."
              );
              return;
            }
            if (typeof data?.slug === "string" && data.slug.length > 0) {
              router.push(`/forum/t/${data.slug}`);
              return;
            }
            router.push(`/forum/c/${categorySlug}`);
          }}
        >
          {/* Category */}
          <div>
            <label className="rv-label-field" htmlFor="nt-category">Categoria</label>
            {isLoadingCats ? (
              <div className="rv-input h-11 animate-pulse bg-[var(--rv-surface-2)]" />
            ) : (
              <select
                id="nt-category"
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value)}
                className="rv-input"
                style={{ cursor: "pointer" }}
              >
                {categories.length === 0 && (
                  <option value="">Nenhuma categoria disponível</option>
                )}
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="rv-label-field" htmlFor="nt-title">
              Título
              <span className={`ml-2 text-[9px] ${titleLen > 120 ? "text-[var(--rv-red)]" : "text-[var(--rv-text-dim)]"}`}>
                {titleLen}/120
              </span>
            </label>
            <input
              id="nt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Como configurar o ambiente de desenvolvimento..."
              maxLength={120}
              required
              className="rv-input"
            />
          </div>

          {/* Content */}
          <div>
            <label className="rv-label-field" htmlFor="nt-content">
              Conteúdo
              <span className="ml-2 text-[9px] text-[var(--rv-text-dim)]">{contentLen} caracteres</span>
            </label>
            <div className="mt-1 rounded-xl border border-[var(--rv-border)] overflow-hidden focus-within:border-[var(--rv-border-hover)]">
              <ForumRichEditor content={content} onChange={setContent} disabled={isSubmitting} />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rv-badge rv-badge-red px-4 py-3 text-sm rounded-xl w-full text-left">
              ⚠ {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || isLoadingCats}
              className="rv-btn rv-btn-primary h-12 px-10 text-xs sm:text-sm w-full sm:w-auto gap-2 disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Publicando...
                </>
              ) : (
                <>◈ Publicar Tópico</>
              )}
            </button>
            <Link href="/forum" className="rv-btn rv-btn-ghost h-12 px-8 text-xs w-full sm:w-auto">
              Cancelar
            </Link>
          </div>
        </form>

        {/* Tips */}
        <div className="mt-6 rv-card p-5 border-[var(--rv-cyan)]/20">
          <h3 className="rv-label text-[10px] text-[var(--rv-cyan)] mb-3 tracking-widest">💡 DICAS PARA UM BOM TÓPICO</h3>
          <ul className="space-y-2">
            {[
              "Use um título claro e específico.",
              "Inclua prints ou logs ao reportar bugs.",
              "Mantenha o conteúdo relacionado à categoria escolhida.",
              "Verifique se já existe um tópico semelhante antes de criar.",
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[var(--rv-text-muted)]" style={{ fontFamily: "var(--font-body)" }}>
                <span className="text-[var(--rv-cyan)] flex-shrink-0 font-bold">{i + 1}.</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
