"use client";

import Link from "next/link";
import Image from "next/image";
import React, { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { fixImageUrl } from "@/lib/utils";
import type { Article } from "@/types";

function StatusBadge({ status }: { status?: string }) {
  const s = (status ?? "draft").toLowerCase();
  const label =
    s === "published"
      ? "Publicado"
      : s === "pending"
        ? "Revisão"
        : s === "rejected"
          ? "Rejeitado"
          : s === "scheduled"
            ? "Agendado"
            : s === "archived"
              ? "Arquivado"
              : "Rascunho";
  const variant = s === "published" ? "default" : s === "rejected" ? "destructive" : "secondary";
  return <Badge variant={variant}>{label}</Badge>;
}

export function PublicArticleCard({
  article,
  showStatusBadge,
  useDashboardPreview,
}: {
  article: Article;
  showStatusBadge?: boolean;
  useDashboardPreview?: boolean;
}) {
  const href = useMemo(() => {
    const slug = encodeURIComponent(article.slug);
    if (useDashboardPreview) {
      const status = (article.status ?? "").toLowerCase();
      return status === "published" ? `/blog/${slug}` : `/dashboard/blog/${slug}/preview`;
    }
    return `/blog/${slug}`;
  }, [article.slug, article.status, useDashboardPreview]);

  const img = useMemo(() => fixImageUrl(article.image ?? null), [article.image]);

  return (
    <Link
      href={href}
      className="group overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl transition hover:border-white/20"
    >
      {img ? (
        <Image
          src={img}
          alt={article.title}
          width={1200}
          height={480}
          sizes="(min-width: 768px) 33vw, 100vw"
          className="h-44 w-full object-cover transition duration-700 group-hover:scale-105"
        />
      ) : null}
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          {showStatusBadge ? <StatusBadge status={article.status} /> : null}
        </div>
        <div className="mt-3 text-lg font-black tracking-tight text-foreground line-clamp-2">{article.title}</div>
        {article.excerpt ? (
          <div className="mt-2 text-sm text-muted-foreground line-clamp-3">{article.excerpt}</div>
        ) : null}
      </div>
    </Link>
  );
}
