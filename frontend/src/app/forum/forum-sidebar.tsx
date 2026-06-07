import Link from "next/link";
import { ForumHeaderActions } from "./forum-header-actions";

type ForumCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  topic_count: number;
};

const RULES = [
  "Mantenha o respeito em todas as discussões.",
  "Sem conteúdo fora do tema do tópico.",
  "Use a categoria correta ao criar um tópico.",
  "Inclua detalhes e prints ao reportar problemas.",
];

export function ForumSidebar({
  categories,
  currentSlug,
}: {
  categories: ForumCategory[];
  currentSlug?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Categories */}
      {categories.length > 0 && (
        <div className="rv-card p-5 flex flex-col gap-3">
          <h3 className="rv-display text-sm text-[var(--rv-text-primary)] flex items-center gap-2">
            <span className="text-[var(--rv-accent)]">◈</span> Categorias
          </h3>
          <div className="space-y-0.5">
            <Link
              href="/forum"
              prefetch={false}
              className={`flex items-center justify-between p-2.5 rounded-xl transition-all text-[10px] ${
                !currentSlug
                  ? "bg-[var(--rv-accent-glow)] text-[var(--rv-accent)]"
                  : "text-[var(--rv-text-muted)] hover:bg-[var(--rv-surface-2)] hover:text-[var(--rv-text-primary)]"
              }`}
            >
              Todos os tópicos
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/forum/c/${cat.slug}`}
                prefetch={false}
                className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${
                  currentSlug === cat.slug
                    ? "bg-[var(--rv-accent-glow)] text-[var(--rv-accent)]"
                    : "text-[var(--rv-text-muted)] hover:bg-[var(--rv-surface-2)] hover:text-[var(--rv-text-primary)]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm flex-shrink-0">{cat.icon || "◈"}</span>
                  <span className="text-[10px] truncate">{cat.name}</span>
                </div>
                <span className="text-[9px] text-[var(--rv-text-dim)] flex-shrink-0 ml-1 tabular-nums">
                  {cat.topic_count}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Participate */}
      <div className="rv-card p-5 flex flex-col gap-3 bg-[linear-gradient(135deg,rgba(68,183,139,0.08),rgba(6,182,212,0.04))]">
        <h3 className="rv-display text-sm text-[var(--rv-text-primary)]">Participe</h3>
        <p className="text-xs text-[var(--rv-text-muted)] font-[var(--font-body)]">
          Crie um tópico ou responda às discussões da comunidade.
        </p>
        <ForumHeaderActions newTopicHref="/forum/new" />
        <Link href="/register" prefetch={false} className="rv-btn rv-btn-ghost w-full h-10 text-xs">
          Criar Conta Grátis
        </Link>
      </div>

      {/* Rules */}
      <div className="rv-card p-5 flex flex-col gap-3">
        <h3 className="rv-display text-sm text-[var(--rv-text-primary)] flex items-center gap-2">
          <span className="text-[var(--rv-gold)]">◆</span> Regras
        </h3>
        <ol className="space-y-3">
          {RULES.map((r, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-xs text-[var(--rv-text-muted)] font-[var(--font-body)]"
            >
              <span className="rv-label text-[var(--rv-accent)] font-bold flex-shrink-0 mt-0.5">
                {i + 1}.
              </span>
              {r}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
