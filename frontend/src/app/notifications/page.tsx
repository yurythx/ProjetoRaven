"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useNotifications } from "@/contexts/notifications";
import { Bell, BellOff, Check, Loader2 } from "lucide-react";

function verbLabel(verb: string) {
  if (verb === "forum_reply") return "Fórum";
  if (verb === "blog_comment") return "Blog";
  return "Notificação";
}

function verbBadgeClass(verb: string) {
  if (verb === "forum_reply") return "rv-badge-cyan";
  if (verb === "blog_comment") return "rv-badge-purple";
  return "rv-badge";
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { notifications, unreadCount, fetched, markAllRead, markRead } = useNotifications();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--rv-accent)]" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-orb rv-animate-pulse-glow w-[400px] h-[400px] top-[-10%] right-[-5%] bg-[var(--rv-accent)] opacity-10" />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-10 sm:py-16 sm:px-6">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <span className="rv-badge rv-badge-purple mb-3 inline-flex">
              <Bell className="h-3 w-3 mr-1" />
              Notificações
            </span>
            <h1 className="rv-display text-3xl sm:text-4xl text-[var(--rv-text-primary)]">
              Suas Notificações
            </h1>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => void markAllRead()}
              className="rv-btn rv-btn-ghost text-xs h-9 px-4 flex items-center gap-2"
            >
              <Check className="h-3 w-3" />
              Marcar todas lidas
            </button>
          )}
        </div>

        {!fetched ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--rv-accent)]" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="rv-card p-12 text-center">
            <BellOff className="h-10 w-10 mx-auto mb-4 text-[var(--rv-text-dim)] opacity-40" />
            <h2 className="rv-display text-xl text-[var(--rv-text-primary)] mb-2">Nenhuma notificação</h2>
            <p className="text-sm text-[var(--rv-text-muted)] font-[var(--font-body)]">
              Quando alguém responder seus tópicos ou comentar seus artigos, você será notificado aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`rv-card p-4 sm:p-5 flex items-start gap-4 transition-all ${n.read ? "opacity-60" : "border-[var(--rv-accent)]/20"}`}
              >
                <div className={`h-2 w-2 rounded-full mt-2 flex-shrink-0 ${n.read ? "bg-[var(--rv-text-dim)]" : "bg-[var(--rv-accent)]"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`rv-badge ${verbBadgeClass(n.verb)} text-[8px]`}>{verbLabel(n.verb)}</span>
                    <span className="rv-label text-[9px] text-[var(--rv-text-dim)]" suppressHydrationWarning>
                      {new Date(n.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--rv-text-muted)] leading-relaxed font-[var(--font-body)]">
                    {n.message}
                  </p>
                  {n.target_url && (
                    <Link
                      href={n.target_url}
                      onClick={() => { if (!n.read) void markRead(n.id); }}
                      className="text-xs text-[var(--rv-accent)] hover:underline mt-1 inline-block"
                    >
                      Ver →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
