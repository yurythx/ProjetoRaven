"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { ForumRichEditor } from "@/components/forum-rich-editor";
import { stripHtml } from "@/lib/utils";

export function ReplyComposer({ topicId, disabled }: { topicId: string; disabled: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAuthed = Boolean(user);
  const isGameUser = React.useMemo(() => {
    const u = (user ?? null) as Record<string, unknown> | null;
    if (!u) return false;
    const isVerified = Boolean(u["is_verified"]);
    const isActive = u["is_active"] === undefined ? true : Boolean(u["is_active"]);
    const isBanned = Boolean(u["is_banned"]);
    return isVerified && isActive && !isBanned;
  }, [user]);

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5">
      <div className="text-sm font-semibold text-foreground">Responder</div>
      {!isAuthed ? <div className="mt-2 text-sm text-foreground/80">Entre para responder.</div> : null}
      {isAuthed && !isGameUser ? (
        <div className="mt-2 text-sm text-foreground/80">Sua conta precisa estar ativa para responder.</div>
      ) : null}
      {disabled ? <div className="mt-2 text-sm text-foreground/80">Tópico fechado.</div> : null}

      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!isAuthed || !isGameUser || disabled) return;
          setError(null);
          if (stripHtml(content).length < 3) {
            setError("Conteúdo muito curto.");
            return;
          }
          setIsSubmitting(true);
          const res = await fetch("/api/forum/replies", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ topic: topicId, content }),
          });
          setIsSubmitting(false);
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            const message =
              typeof data?.error === "string"
                ? data.error
                : typeof data?.detail === "string"
                  ? data.detail
                  : "Falha ao enviar reply.";
            setError(message);
            return;
          }
          setContent("");
          router.refresh();
        }}
      >
        <ForumRichEditor
          content={content}
          onChange={setContent}
          disabled={!isAuthed || !isGameUser || disabled || isSubmitting}
          className="min-h-[140px]"
        />
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <button
          type="submit"
          disabled={!isAuthed || !isGameUser || disabled || isSubmitting || stripHtml(content).length < 3}
          className="h-11 rounded-xl bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
        >
          {isSubmitting ? "Enviando..." : "Enviar"}
        </button>
      </form>
    </div>
  );
}
