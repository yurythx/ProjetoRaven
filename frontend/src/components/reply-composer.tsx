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
    <div>
      {!isAuthed ? (
        <p className="text-sm text-[var(--rv-text-muted)] py-2">Entre para responder.</p>
      ) : isAuthed && !isGameUser ? (
        <p className="text-sm text-[var(--rv-text-muted)] py-2">Sua conta precisa estar ativa para responder.</p>
      ) : disabled ? (
        <p className="text-sm text-[var(--rv-text-muted)] py-2">Tópico fechado.</p>
      ) : null}

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
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!isAuthed || !isGameUser || disabled || isSubmitting || stripHtml(content).length < 3}
            className="rv-btn rv-btn-primary h-10 px-6 text-xs disabled:opacity-40"
          >
            {isSubmitting ? "Enviando..." : "Enviar Resposta"}
          </button>
        </div>
      </form>
    </div>
  );
}
