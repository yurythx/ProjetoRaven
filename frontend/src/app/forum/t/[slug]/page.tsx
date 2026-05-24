import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/json-ld";
import { getSiteBaseUrl } from "@/lib/env";
import { HiddenRepliesPanel } from "@/components/hidden-replies-panel";
import { ReplyComposer } from "@/components/reply-composer";
import { ReplyEditActions } from "@/components/reply-edit-actions";
import { ReplyModerationActions } from "@/components/reply-moderation-actions";
import { ReplyReactions } from "@/components/reply-reactions";
import { TopicEditActions } from "@/components/topic-edit-actions";
import { TopicModerationActions } from "@/components/topic-moderation-actions";
import { TopicReactions } from "@/components/topic-reactions";
import { backendFetch } from "@/lib/backend";
import { sanitizeRichTextHtml } from "@/lib/sanitize-html";
import { stripHtml } from "@/lib/utils";

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

type TopicDetail = {
  id: string; title: string; slug: string; content: string;
  reply_count: number; view_count: number; status: string;
  is_pinned: boolean; is_locked: boolean;
  created_at: string; updated_at: string;
  author: { id: string; username: string; display_name: string };
  category: { id: string; name: string; slug: string };
};

type ReplyListItem = {
  id: string; content: string;
  author: { id: string; username: string; display_name: string };
  is_solution: boolean; is_hidden: boolean;
  reactions: Record<string, number>;
  created_at: string; updated_at: string;
};

type ReactionSummary = Record<string, number>;

function getLastPage(count: number, pageSize: number) {
  return Math.max(1, Math.ceil(count / pageSize));
}

function makeDescription(text: string) {
  const s = stripHtml(text).trim().replace(/\s+/g, " ");
  if (!s) return "Discussão no fórum do Projeto Raven.";
  return s.length > 160 ? `${s.slice(0, 157)}...` : s;
}

// Try v1 endpoint, fallback to legacy
async function fetchTopic(slug: string) {
  const r1 = await backendFetch<TopicDetail>(`/api/v1/forum/public/topics/${encodeURIComponent(slug)}/`, {
    method: "GET", cache: "no-store",
  });
  if (r1.ok) return r1;
  return backendFetch<TopicDetail>(`/api/forum/public/topics/${encodeURIComponent(slug)}/`, {
    method: "GET", cache: "no-store",
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const res = await fetchTopic(slug);
  const canonical = `/forum/t/${encodeURIComponent(slug)}`;
  if (!res.ok) return { title: "Tópico | Fórum | RAVEN", alternates: { canonical } };
  const topic = res.data;
  const title = `${topic.title} | Fórum | RAVEN`;
  const description = makeDescription(topic.content);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: "article", url: canonical },
    twitter: { card: "summary", title, description },
  };
}

function parsePositiveInt(v: unknown) {
  if (typeof v !== "string") return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default async function ForumTopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const topicRes = await fetchTopic(slug);
  if (!topicRes.ok) {
    if ("error" in topicRes && topicRes.error.status === 404) notFound();
    throw new Error("Falha ao carregar o tópico.");
  }

  const topic = topicRes.data;
  const pageSize = 20;
  const requestedPage = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const lastPage = getLastPage(topic.reply_count, pageSize);
  const currentPageRaw = parsePositiveInt(requestedPage) ?? lastPage;
  const currentPage = Math.min(Math.max(1, currentPageRaw), lastPage);

  // Try v1, fallback to legacy for replies
  let repliesRes = await backendFetch<Paginated<ReplyListItem>>(
    `/api/v1/forum/public/replies/?topic=${encodeURIComponent(topic.slug)}&page=${currentPage}&page_size=${pageSize}`,
    { method: "GET", cache: "no-store" }
  );
  if (!repliesRes.ok) {
    repliesRes = await backendFetch<Paginated<ReplyListItem>>(
      `/api/forum/public/replies/?topic=${encodeURIComponent(topic.slug)}&page=${currentPage}&page_size=${pageSize}`,
      { method: "GET", cache: "no-store" }
    );
  }
  const replies = repliesRes.ok ? repliesRes.data.results : [];

  let reactionsRes = await backendFetch<ReactionSummary>(
    `/api/v1/forum/public/topics/${encodeURIComponent(topic.slug)}/reactions/`,
    { method: "GET", cache: "no-store" }
  );
  if (!reactionsRes.ok) {
    reactionsRes = await backendFetch<ReactionSummary>(
      `/api/forum/public/topics/${encodeURIComponent(topic.slug)}/reactions/`,
      { method: "GET", cache: "no-store" }
    );
  }
  const reactions = reactionsRes.ok ? reactionsRes.data : {};

  const authorName = topic.author.display_name || topic.author.username;
  const base = getSiteBaseUrl();
  const topicSchema = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: topic.title,
    text: makeDescription(topic.content),
    url: `${base}/forum/t/${topic.slug}`,
    datePublished: topic.created_at,
    dateModified: topic.updated_at,
    author: {
      "@type": "Person",
      name: authorName,
      url: `${base}/u/${topic.author.username}`,
    },
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/ReplyAction",
      userInteractionCount: topic.reply_count,
    },
  };

  return (
    <div className="relative min-h-screen">
      <JsonLd data={topicSchema} />
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-orb" style={{ width: "400px", height: "400px", top: "-10%", right: "-5%", background: "var(--rv-accent)", opacity: 0.12 }} />
        <div className="rv-orb" style={{ width: "250px", height: "250px", bottom: "15%", left: "-5%", background: "var(--rv-cyan)", opacity: 0.08 }} />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        {/* ── Breadcrumb & meta ── */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <nav className="flex items-center gap-2 rv-label text-[9px] text-[var(--rv-text-dim)] flex-wrap">
            <Link href="/forum" className="hover:text-[var(--rv-accent)] transition-colors">Fórum</Link>
            <span>›</span>
            <Link href={`/forum/c/${topic.category.slug}`} className="hover:text-[var(--rv-accent)] transition-colors">
              {topic.category.name}
            </Link>
            <span>›</span>
            <span className="text-[var(--rv-text-muted)] truncate max-w-[140px] sm:max-w-[250px]">{topic.title}</span>
          </nav>
          <div className="flex items-center gap-3">
            <span className="rv-badge rv-badge-cyan text-[9px]">💬 {topic.reply_count} resp.</span>
            <span className="rv-badge rv-badge-purple text-[9px]">👁 {topic.view_count} views</span>
          </div>
        </div>

        {/* ── Topic ── */}
        <article className="rv-card p-5 sm:p-8 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              {topic.is_pinned && <span className="rv-badge rv-badge-gold text-[8px]">📌 Fixado</span>}
              {topic.is_locked && <span className="rv-badge rv-badge-red text-[8px]">🔒 Fechado</span>}
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[var(--rv-accent)] to-[var(--rv-cyan)] flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                  {authorName[0].toUpperCase()}
                </div>
                {topic.author?.username ? (
                  <Link href={`/u/${topic.author.username}`} className="rv-label text-[10px] text-[var(--rv-text-muted)] hover:text-[var(--rv-accent)] transition-colors">
                    {authorName}
                  </Link>
                ) : (
                  <span className="rv-label text-[10px] text-[var(--rv-text-muted)]">{authorName}</span>
                )}
              </div>
              <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">
                {new Date(topic.created_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
            <TopicEditActions
              slug={topic.slug}
              authorId={topic.author?.id ?? null}
              initialTitle={topic.title}
              initialContent={topic.content}
            />
          </div>

          <h1 className="rv-display text-2xl sm:text-3xl text-[var(--rv-text-primary)] mb-6">{topic.title}</h1>

          <div
            className="prose prose-sm sm:prose-base prose-invert max-w-none
              prose-p:text-[var(--rv-text-muted)] prose-headings:text-[var(--rv-text-primary)]
              prose-a:text-[var(--rv-accent)] prose-a:no-underline hover:prose-a:underline
              prose-code:text-[var(--rv-cyan)] prose-code:bg-[var(--rv-surface-2)] prose-code:rounded prose-code:px-1
              prose-blockquote:border-l-[var(--rv-accent)] prose-blockquote:text-[var(--rv-text-muted)]"
            dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(topic.content) }}
          />
        </article>

        <TopicReactions topicId={topic.id} summary={reactions} />
        <TopicModerationActions slug={topic.slug} isPinned={topic.is_pinned} isLocked={topic.is_locked} status={topic.status} />
        <HiddenRepliesPanel topicSlug={topic.slug} />

        {/* ── Replies ── */}
        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <span className="rv-badge rv-badge-purple">◈ Respostas ({topic.reply_count})</span>
          </div>

          {!repliesRes.ok && (
            <div className="rv-card p-6 text-center text-[var(--rv-text-muted)]" style={{ fontFamily: "var(--font-body)" }}>
              Não foi possível carregar as respostas.
            </div>
          )}

          {replies.map((r) => {
            const rAuthorName = r.author.display_name || r.author.username;
            return (
              <div key={r.id} className={`rv-card p-5 sm:p-6 ${r.is_solution ? "border-[var(--rv-accent)]/40" : ""}`}
                style={r.is_solution ? { background: "rgba(139,92,246,0.05)" } : {}}>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[var(--rv-surface-2)] to-[var(--rv-surface)] border border-[var(--rv-border)] flex items-center justify-center text-[var(--rv-text-muted)] font-black text-xs flex-shrink-0">
                      {rAuthorName[0].toUpperCase()}
                    </div>
                    {r.author?.username ? (
                      <Link href={`/u/${r.author.username}`} className="rv-label text-[10px] text-[var(--rv-text-muted)] hover:text-[var(--rv-accent)] transition-colors">
                        {rAuthorName}
                      </Link>
                    ) : (
                      <span className="rv-label text-[10px] text-[var(--rv-text-muted)]">{rAuthorName}</span>
                    )}
                    {r.is_solution && <span className="rv-badge rv-badge-cyan text-[8px]">✓ Solução</span>}
                    {r.is_hidden && <span className="rv-badge rv-badge-red text-[8px]">Oculto</span>}
                    <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <ReplyEditActions replyId={r.id} authorId={r.author?.id ?? null} initialContent={r.content} />
                </div>

                <div
                  className="prose prose-sm prose-invert max-w-none
                    prose-p:text-[var(--rv-text-muted)] prose-headings:text-[var(--rv-text-primary)]
                    prose-a:text-[var(--rv-accent)] prose-code:text-[var(--rv-cyan)]
                    prose-code:bg-[var(--rv-surface-2)] prose-code:rounded prose-code:px-1"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(r.content) }}
                />

                <div className="mt-4 flex items-center justify-between">
                  <ReplyReactions replyId={r.id} summary={r.reactions ?? {}} />
                  <ReplyModerationActions replyId={r.id} isSolution={r.is_solution} isHidden={r.is_hidden} />
                </div>
              </div>
            );
          })}

          {repliesRes.ok && replies.length === 0 && (
            <div className="rv-card p-6 sm:p-10 text-center">
              <div className="text-3xl mb-3">💬</div>
              <h3 className="rv-display text-xl text-[var(--rv-text-primary)] mb-2">Nenhuma resposta ainda</h3>
              <p className="text-[var(--rv-text-muted)] text-sm" style={{ fontFamily: "var(--font-body)" }}>
                Seja o primeiro a responder este tópico.
              </p>
            </div>
          )}

          {/* Pagination */}
          {lastPage > 1 && (
            <div className="flex items-center justify-between gap-4 mt-6">
              <Link
                href={`/forum/t/${topic.slug}?page=${currentPage - 1}`}
                aria-disabled={currentPage <= 1}
                className={`rv-btn rv-btn-ghost text-xs px-6 h-10 ${currentPage <= 1 ? "pointer-events-none opacity-30" : ""}`}
              >
                ← Anterior
              </Link>
              <span className="rv-label text-[10px] text-[var(--rv-text-dim)]">
                Página {currentPage} de {lastPage}
              </span>
              <Link
                href={`/forum/t/${topic.slug}?page=${currentPage + 1}`}
                aria-disabled={currentPage >= lastPage}
                className={`rv-btn rv-btn-ghost text-xs px-6 h-10 ${currentPage >= lastPage ? "pointer-events-none opacity-30" : ""}`}
              >
                Próxima →
              </Link>
            </div>
          )}
        </div>

        {/* ── Reply Composer ── */}
        <div className="mt-10 rv-card p-5 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="rv-badge rv-badge-purple">+ Responder</span>
          </div>
          <ReplyComposer topicId={topic.id} disabled={topic.is_locked} />
        </div>
      </div>
    </div>
  );
}
