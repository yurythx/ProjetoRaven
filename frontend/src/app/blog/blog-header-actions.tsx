"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";

export function BlogHeaderActions() {
  const { user, isLoading } = useAuth();
  const u = (user ?? null) as Record<string, unknown> | null;
  const canEdit = Boolean(u?.is_admin || u?.is_blog_editor || u?.is_staff || u?.is_superuser) && !isLoading;

  if (!canEdit) return null;

  return (
    <div className="flex items-center gap-3">
      <Link href="/blog/comentarios" className="rv-btn rv-btn-ghost text-xs px-5 h-11 gap-2">
        💬 Comentários
      </Link>
      <Link href="/blog/novo" className="rv-btn rv-btn-primary text-xs px-8 h-11 gap-2">
        <span>+</span> Novo Post
      </Link>
    </div>
  );
}
