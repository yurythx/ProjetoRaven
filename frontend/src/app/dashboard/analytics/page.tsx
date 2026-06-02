"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Users, BookOpen } from "lucide-react";

type AnalyticsData = {
  users: {
    total: number;
    new_today: number;
    new_week: number;
    new_month: number;
    verified: number;
    banned: number;
    online_today: number;
  };
  content: {
    blog_published: number;
    forum_topics: number;
    forum_replies_today: number;
  };
  registrations_chart: { date: string; users: number }[];
  generated_at: string;
};

async function fetchAnalytics(): Promise<AnalyticsData> {
  const res = await fetch("/api/dashboard/analytics");
  if (!res.ok) throw new Error("Erro ao carregar analytics.");
  return res.json();
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div className="rv-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--rv-text-muted)] uppercase tracking-widest">{label}</span>
        <Icon className="h-4 w-4 text-[var(--rv-text-dim)]" />
      </div>
      <p className={`rv-display text-3xl ${accent ? "text-[var(--rv-accent)]" : "text-[var(--rv-text-primary)]"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-[var(--rv-text-muted)]">{sub}</p>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rv-card p-5 h-28 bg-muted/20" />
        ))}
      </div>
      <div className="rv-card p-6 h-72 bg-muted/20" />
    </div>
  );
}

export default function AnalyticsPage() {
  const { data, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["admin-analytics"],
    queryFn: fetchAnalytics,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16">
      <div className="space-y-4 mb-12">
        <span className="rv-badge rv-badge-cyan">◈ Analytics</span>
        <h1 className="rv-display text-4xl sm:text-6xl text-[var(--rv-text-primary)] tracking-tight">
          Métricas da <span className="text-[var(--rv-accent)]">Plataforma</span>
        </h1>
        {data && (
          <p className="text-xs text-[var(--rv-text-muted)]">
            Atualizado em <span suppressHydrationWarning>{new Date(data.generated_at).toLocaleString("pt-BR")}</span> · Atualiza a cada 2 min
          </p>
        )}
      </div>

      {isLoading && <Skeleton />}
      {error && (
        <div className="rv-card p-6 text-center text-red-400">
          Erro ao carregar dados. Verifique as permissões.
        </div>
      )}

      {data && (
        <div className="space-y-8">
          {/* User stats */}
          <section>
            <h2 className="text-xs uppercase tracking-widest text-[var(--rv-text-muted)] mb-4 flex items-center gap-2">
              <Users className="h-3 w-3" /> Usuários
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total"        value={data.users.total}       icon={Users} sub={`${data.users.verified} verificados`} />
              <StatCard label="Hoje"         value={data.users.new_today}   icon={Users} accent sub="novos registros" />
              <StatCard label="Esta semana"  value={data.users.new_week}    icon={Users} sub="últimos 7 dias" />
              <StatCard label="Online hoje"  value={data.users.online_today} icon={Users} sub={`${data.users.banned} banidos`} />
            </div>
          </section>

          {/* Registrations chart */}
          <section className="rv-card p-6">
            <h2 className="text-xs uppercase tracking-widest text-[var(--rv-text-muted)] mb-6">
              Registros (últimos 30 dias)
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.registrations_chart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--rv-accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--rv-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--rv-text-muted)" }}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis tick={{ fontSize: 10, fill: "var(--rv-text-muted)" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--rv-bg-card)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--rv-text-muted)" }}
                  itemStyle={{ color: "var(--rv-accent)" }}
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  name="Registros"
                  stroke="var(--rv-accent)"
                  strokeWidth={2}
                  fill="url(#regGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </section>

          {/* Content stats */}
          {data.content && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-[var(--rv-text-muted)] mb-4 flex items-center gap-2">
                <BookOpen className="h-3 w-3" /> Conteúdo
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard label="Posts publicados" value={data.content.blog_published}     icon={BookOpen} />
                <StatCard label="Tópicos do fórum" value={data.content.forum_topics}       icon={BookOpen} />
                <StatCard label="Replies hoje"     value={data.content.forum_replies_today} icon={BookOpen} accent />
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  );
}
