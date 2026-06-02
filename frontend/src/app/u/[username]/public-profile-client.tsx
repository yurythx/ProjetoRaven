"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, MessageSquare, FileText, Calendar, Globe } from "lucide-react";
import { fixImageUrl } from "@/lib/utils";

type RecentTopic = {
  slug: string;
  title: string;
  category_name: string;
  category_slug: string;
  created_at: string;
  reply_count: number;
};

type RecentPost = {
  slug: string;
  title: string;
  published_at: string;
  cover_image?: string;
};

type PublicProfile = {
  username: string;
  display_name: string;
  date_joined: string;
  is_verified: boolean;
  bio?: string;
  website?: string | null;
  avatar?: string | null;
  stats: {
    forum_topics: number;
    forum_replies: number;
    blog_posts: number;
  };
  recent_topics: RecentTopic[];
  recent_posts: RecentPost[];
};

async function fetchProfile(username: string): Promise<PublicProfile> {
  const res = await fetch(`/api/users/${encodeURIComponent(username)}`);
  if (res.status === 404) throw new Error("not_found");
  if (!res.ok) throw new Error("error");
  return res.json();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}

export function PublicProfileClient({ username }: { username: string }) {
  const router = useRouter();
  const [avatarError, setAvatarError] = useState(false);

  const { data: profile, isLoading, isError, error } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () => fetchProfile(username),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--rv-accent)] opacity-20" />
          <div className="absolute inset-0 rounded-full border-t-2 border-[var(--rv-accent)] animate-spin" />
        </div>
      </div>
    );
  }

  if (isError) {
    const notFound = (error as Error).message === "not_found";
    return (
      <div className="flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="text-5xl">{notFound ? "◈" : "⚠"}</div>
        <h1 className="rv-display text-3xl text-[var(--rv-text-primary)]">
          {notFound ? "Perfil não encontrado" : "Erro ao carregar perfil"}
        </h1>
        <p className="text-[var(--rv-text-muted)] max-w-sm">
          {notFound
            ? `O usuário "${username}" não existe ou está inativo.`
            : "Tente novamente mais tarde."}
        </p>
        <Link href="/" className="rv-btn rv-btn-ghost px-8 h-10 mt-2">
          ← Início
        </Link>
      </div>
    );
  }

  if (!profile) return null;

  const initial = profile.display_name[0].toUpperCase();
  const hasActivity =
    (profile.recent_topics?.length ?? 0) > 0 ||
    (profile.recent_posts?.length ?? 0) > 0;

  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 sm:py-16 sm:px-6">
        {/* Hero header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-10">
          <div className="relative h-20 w-20 flex-shrink-0">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--rv-accent)] to-[var(--rv-cyan)]" />
            <div className="absolute inset-[3px] rounded-[13px] bg-[var(--rv-surface)] overflow-hidden flex items-center justify-center">
              {profile.avatar && !avatarError ? (
                <Image
                  src={fixImageUrl(profile.avatar) ?? ""}
                  alt={profile.display_name}
                  width={74}
                  height={74}
                  className="w-full h-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <span className="rv-display text-3xl text-[var(--rv-accent)]">{initial}</span>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="rv-label text-[9px] text-[var(--rv-text-dim)] tracking-[0.35em]">PERFIL PÚBLICO</span>
              {profile.is_verified && (
                <span className="rv-badge rv-badge-cyan text-[8px] px-2 py-0.5">✓ Verificado</span>
              )}
            </div>
            <h1 className="rv-display text-4xl sm:text-5xl text-[var(--rv-text-primary)] truncate">
              {profile.display_name}
            </h1>
            <p className="text-sm text-[var(--rv-text-dim)] mt-1 flex items-center gap-2">
              <span>@{profile.username}</span>
              <span className="text-[var(--rv-border)]">·</span>
              <Calendar className="h-3 w-3" />
              <span suppressHydrationWarning>
                Membro desde{" "}
                {new Date(profile.date_joined).toLocaleDateString("pt-BR", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </p>
            {profile.bio && (
              <p className="text-sm text-[var(--rv-text-muted)] mt-2 max-w-lg">{profile.bio}</p>
            )}
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[var(--rv-accent)] hover:underline mt-1"
              >
                <Globe className="h-3 w-3" />
                {profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="rv-card p-5 mb-8 grid grid-cols-3 divide-x divide-[var(--rv-border)]">
          {[
            { label: "Tópicos", value: profile.stats?.forum_topics ?? 0, icon: MessageSquare, href: `/forum?author=${username}` },
            { label: "Respostas", value: profile.stats?.forum_replies ?? 0, icon: MessageSquare, href: null },
            { label: "Artigos", value: profile.stats?.blog_posts ?? 0, icon: FileText, href: `/blog?author=${username}` },
          ].map(({ label, value, icon: Icon, href }) => (
            href ? (
              <Link key={label} href={href} className="flex flex-col items-center gap-1 py-1 hover:opacity-80 transition-opacity">
                <Icon className="h-4 w-4 text-[var(--rv-text-dim)]" />
                <span className="rv-display text-2xl text-[var(--rv-text-primary)]">{value}</span>
                <span className="text-[10px] text-[var(--rv-text-muted)] uppercase tracking-widest">{label}</span>
              </Link>
            ) : (
              <div key={label} className="flex flex-col items-center gap-1 py-1">
                <Icon className="h-4 w-4 text-[var(--rv-text-dim)]" />
                <span className="rv-display text-2xl text-[var(--rv-text-primary)]">{value}</span>
                <span className="text-[10px] text-[var(--rv-text-muted)] uppercase tracking-widest">{label}</span>
              </div>
            )
          ))}
        </div>

        <div className="space-y-8">
          {/* Recent forum topics */}
          {(profile.recent_topics?.length ?? 0) > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-[var(--rv-text-muted)] mb-4 flex items-center gap-2">
                <MessageSquare className="h-3 w-3" /> Tópicos recentes no fórum
              </h2>
              <div className="space-y-2">
                {profile.recent_topics.map((topic) => (
                  <div
                    key={topic.slug}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/forum/t/${topic.slug}`)}
                    onKeyDown={(e) => e.key === "Enter" && router.push(`/forum/t/${topic.slug}`)}
                    className="rv-card p-4 flex items-start justify-between gap-4 hover:border-[var(--rv-border-hover)] transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--rv-text-primary)] truncate">{topic.title}</p>
                      <p className="text-xs text-[var(--rv-text-dim)] mt-0.5">
                        <Link
                          href={`/forum/c/${topic.category_slug}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-[var(--rv-accent)] transition-colors"
                        >
                          {topic.category_name}
                        </Link>
                        {" · "}
                        {formatDate(topic.created_at)}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-[var(--rv-text-dim)] flex-shrink-0 mt-0.5">
                      <MessageSquare className="h-3 w-3" />
                      {topic.reply_count}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent blog posts */}
          {(profile.recent_posts?.length ?? 0) > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-[var(--rv-text-muted)] mb-4 flex items-center gap-2">
                <BookOpen className="h-3 w-3" /> Artigos publicados
              </h2>
              <div className="space-y-2">
                {profile.recent_posts.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="rv-card p-4 flex items-center gap-4 hover:border-[var(--rv-border-hover)] transition-colors block"
                  >
                    {post.cover_image && (
                      <div className="relative h-12 w-16 rounded-lg bg-[var(--rv-surface-2)] flex-shrink-0 overflow-hidden">
                        <Image
                          src={fixImageUrl(post.cover_image) ?? post.cover_image}
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--rv-text-primary)] truncate">{post.title}</p>
                      <p className="text-xs text-[var(--rv-text-dim)] mt-0.5">{formatDate(post.published_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {!hasActivity && (
            <div className="rv-card p-12 text-center opacity-60">
              <MessageSquare className="h-8 w-8 mx-auto mb-3 text-[var(--rv-text-dim)]" />
              <p className="text-[var(--rv-text-muted)]">Este membro ainda não publicou nenhum conteúdo.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
