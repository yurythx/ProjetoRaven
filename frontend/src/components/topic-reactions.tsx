"use client";

import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";

type ReactionType = "like" | "dislike" | "heart" | "laugh" | "wow";

const REACTIONS: { key: ReactionType; label: string }[] = [
  { key: "like", label: "Like" },
  { key: "dislike", label: "Dislike" },
  { key: "heart", label: "Heart" },
  { key: "laugh", label: "Laugh" },
  { key: "wow", label: "Wow" },
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
      const message =
        typeof data?.error === "string"
          ? data.error
          : typeof data?.detail === "string"
            ? data.detail
            : "Falha ao reagir.";
      setError(message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-6 rounded-2xl border border-foreground/10 bg-background p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm font-semibold text-foreground">Reações</div>
        {!isAuthed ? <div className="text-xs text-foreground/60">Entre para reagir.</div> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        {REACTIONS.map((r) => (
          <button
            key={r.key}
            type="button"
            disabled={!isAuthed || isSubmitting}
            onClick={async () => react(r.key)}
            className="h-10 rounded-xl border border-foreground/15 bg-background px-4 text-sm font-medium text-foreground disabled:opacity-60"
          >
            {r.label} · {summary[r.key] ?? 0}
          </button>
        ))}
      </div>

      {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
    </div>
  );
}

