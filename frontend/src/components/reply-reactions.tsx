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

export function ReplyReactions({
  replyId,
  summary,
}: {
  replyId: string;
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
    const res = await fetch(`/api/forum/replies/${encodeURIComponent(replyId)}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ reaction }),
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
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {REACTIONS.map((r) => (
          <button
            key={r.key}
            type="button"
            disabled={!isAuthed || isSubmitting}
            onClick={async () => react(r.key)}
            className="h-8 rounded-xl border border-foreground/15 bg-background px-3 text-xs font-medium text-foreground disabled:opacity-60"
          >
            {r.label} · {summary[r.key] ?? 0}
          </button>
        ))}
      </div>
      {error ? <div className="mt-2 text-xs text-red-600">{error}</div> : null}
    </div>
  );
}

