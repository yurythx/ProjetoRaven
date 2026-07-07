"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import { useAuth } from "@/components/auth-provider";
import { ConfirmDialog } from "@/components/rv-confirm-dialog";
import { RvModal } from "@/components/rv-modal";
import { Button } from "@/components/ui/button";
import { stripHtml } from "@/lib/utils";

const ForumRichEditor = dynamic(
  () => import("@/components/forum-rich-editor").then((m) => m.ForumRichEditor),
  {
    ssr: false,
    loading: () => <div className="min-h-[140px] rounded-xl border border-foreground/15 bg-background animate-pulse" />,
  }
);

export function ReplyEditActions({
  replyId,
  authorId,
  initialContent,
}: {
  replyId: string;
  authorId: string | null;
  initialContent: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);

  const { canEdit, isModerator } = useMemo(() => {
    const u = (user ?? null) as Record<string, unknown> | null;
    const mod = Boolean(u?.["is_forum_moderator"]);
    const myId = typeof u?.["id"] === "string" ? (u["id"] as string) : null;
    return {
      isModerator: mod,
      canEdit: Boolean(mod || (authorId && myId && authorId === myId)),
    };
  }, [user, authorId]);

  if (!canEdit) return null;

  const canSubmit = stripHtml(content).length >= 3;

  async function submit() {
    setError(null);
    setIsSubmitting(true);
    const res = await fetch(`/api/forum/replies/${encodeURIComponent(replyId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ content }),
    });
    setIsSubmitting(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        typeof data?.error === "string"
          ? data.error
          : typeof data?.detail === "string"
            ? data.detail
            : "Falha ao atualizar resposta.";
      setError(message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function deleteReply() {
    setIsDeleting(true);
    const res = await fetch(`/api/forum/replies/${encodeURIComponent(replyId)}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    setIsDeleting(false);
    if (!res.ok) return;
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setContent(initialContent);
          setError(null);
          setOpen(true);
        }}
      >
        Editar
      </Button>

      <RvModal
        open={open}
        onClose={() => setOpen(false)}
        title="Editar resposta"
        description="Atualize o conteúdo. Rich text habilitado."
      >
        <div className="grid gap-4">
          <ForumRichEditor content={content} onChange={setContent} disabled={isSubmitting} />
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" type="button" disabled={isSubmitting} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSubmitting || !canSubmit} onClick={submit}>
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </RvModal>

      {(isModerator || authorId) && (
        <>
          <Button variant="destructive" size="sm" disabled={isDeleting} onClick={() => setDeleteOpen(true)}>
            {isDeleting ? "Excluindo..." : "Excluir"}
          </Button>

          <ConfirmDialog
            open={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            title="Excluir resposta"
            description="Esta ação é irreversível. A resposta será removida permanentemente."
            confirmLabel="Excluir"
            onConfirm={deleteReply}
            isPending={isDeleting}
            variant="danger"
          />
        </>
      )}
    </div>
  );
}
