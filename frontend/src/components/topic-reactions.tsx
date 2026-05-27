"use client";

import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";

type ReactionType = "like" | "dislike" | "heart" | "laugh" | "wow";

const REACTIONS: { key: ReactionType; emoji: string; label: string }[] = [
  { key: "like",    emoji: "👍", label: "Curtir"    },
  { key: "heart",   emoji: "❤️", label: "Amei"      },
  { key: "laugh",   emoji: "😂", label: "Haha"      },
  { key: "wow",     emoji: "😮", label: "Uau"       },
  { key: "dislike", emoji: "👎", label: "Não curti" },
];

export function TopicReactions({
  topicId,
  summary,
}: {
  topicId: string;
  summary: Record<string, number>;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAuthed = useMemo(() => Boolean(user), [user]);
  const totalReactions = Object.values(summary).reduce((a, b) => a + b, 0);

  async function react(reaction: ReactionType) {
    if (!isAuthed) return;
    setError(null);
    setIsSubmitting(true);
    const res = await fetch("/api/forum/topic-reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ topic_id: topicId, reaction }),
    });
    setIsSubmitting(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(typeof data?.detail === "string" ? data.detail : "Falha ao reagir.");
      return;
    }
    router.refresh();
  }

  if (totalReactions === 0 && !isAuthed) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {REACTIONS.map((r) => {
        const count = summary[r.key] ?? 0;
        if (!isAuthed && count === 0) return null;
        return (
          <button
            key={r.key}
            type="button"
            title={r.label}
            disabled={!isAuthed || isSubmitting}
            onClick={() => react(r.key)}
            className={`rv-btn h-8 px-3 gap-1.5 text-xs rounded-full border transition-all
              ${count > 0
                ? "border-[var(--rv-accent)]/40 bg-[var(--rv-accent)]/10 text-[var(--rv-accent)]"
                : "border-[var(--rv-border)] bg-transparent text-[var(--rv-text-muted)]"}
              hover:border-[var(--rv-accent)]/60 hover:bg-[var(--rv-accent)]/15 disabled:opacity-40`}
          >
            <span>{r.emoji}</span>
            {count > 0 && <span className="font-semibold">{count}</span>}
          </button>
        );
      })}
      {!isAuthed && totalReactions > 0 && (
        <span className="text-[10px] text-[var(--rv-text-dim)]">Entre para reagir</span>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

