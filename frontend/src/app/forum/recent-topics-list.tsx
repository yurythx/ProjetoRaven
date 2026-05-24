import Link from "next/link";
import { backendFetch } from "@/lib/backend";

type Topic = {
  id: string;
  title: string;
  slug: string;
  author: {
    username: string;
    display_name?: string;
  };
  category_name: string;
  category_slug?: string;
  reply_count: number;
  view_count: number;
  last_reply_at: string | null;
  is_pinned: boolean;
};

/** Safely extract an array from any API response shape (list or paginated) */
function extractList<T>(data: unknown): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export async function RecentTopicsList() {
  // Try v1 endpoint first, then fallback to legacy
  const res = await backendFetch<unknown>(
    "/api/v1/forum/public/topics/popular/?limit=5",
    { method: "GET", next: { revalidate: 60 } }
  );

  if (!res.ok) return null;

  const topics = extractList<Topic>(res.data);
  if (topics.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="rv-badge rv-badge-gold">◆ Tópicos em Destaque</span>
      </div>

      <div className="space-y-3">
        {topics.map((topic) => (
          <Link
            key={topic.id}
            href={`/forum/t/${topic.slug}`}
            className="rv-card group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-3 sm:gap-4 hover:scale-[1.005] transition-all duration-200"
          >
            {/* Left */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {topic.is_pinned && (
                  <span className="rv-badge rv-badge-gold text-[8px]">📌 Fixado</span>
                )}
                <span className="rv-badge rv-badge-cyan text-[8px]">{topic.category_name}</span>
              </div>
              <h3 className="rv-display text-sm sm:text-base text-[var(--rv-text-primary)] group-hover:text-[var(--rv-accent)] transition-colors line-clamp-1">
                {topic.title}
              </h3>
              <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">
                por {topic.author?.display_name || topic.author?.username || "Desconhecido"}
              </span>
            </div>

            {/* Right stats */}
            <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
              <div className="text-center">
                <div className="rv-display text-sm text-[var(--rv-text-primary)]">{topic.reply_count}</div>
                <div className="rv-label text-[8px] text-[var(--rv-text-dim)]">Resp.</div>
              </div>
              <div className="text-center">
                <div className="rv-display text-sm text-[var(--rv-text-primary)]">{topic.view_count}</div>
                <div className="rv-label text-[8px] text-[var(--rv-text-dim)]">Views</div>
              </div>
              <div className="hidden sm:block text-right">
                <div className="rv-label text-[8px] text-[var(--rv-text-dim)]">Última resp.</div>
                <div className="rv-label text-[9px] text-[var(--rv-text-muted)]">
                  {topic.last_reply_at
                    ? new Date(topic.last_reply_at).toLocaleDateString("pt-BR")
                    : "—"}
                </div>
              </div>
              <span className="text-[var(--rv-accent)] group-hover:translate-x-1 transition-transform inline-block text-sm">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
