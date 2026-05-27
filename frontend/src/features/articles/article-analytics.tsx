"use client";

import { useQuery } from "@tanstack/react-query";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { TrendingUp, Eye, FileText, Calendar, BarChart2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

type AnalyticsData = {
  total_articles?: number;
  total_views?: number;
  published_count?: number;
  draft_count?: number;
  most_viewed?: Array<{
    id: string;
    title: string;
    slug: string;
    total_views: number;
    views_last_30_days: number;
  }>;
  views_by_date?: Array<{ date: string; count: number }>;
};

export function ArticleAnalytics() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["article-analytics"],
    queryFn: async () => {
      const res = await fetch("/api/blog-admin/articles/analytics/");
      if (!res.ok) return {};
      return (await res.json()) ?? {};
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-[var(--rv-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  const total_articles = data?.total_articles ?? 0;
  const total_views = data?.total_views ?? 0;
  const published_count = data?.published_count ?? 0;
  const draft_count = data?.draft_count ?? 0;
  const most_viewed = data?.most_viewed ?? [];
  const views_by_date = data?.views_by_date ?? [];

  const statCards = [
    {
      label: "Total de Posts",
      value: total_articles,
      icon: FileText,
      color: "var(--rv-accent)",
      sub: `${published_count} publicados · ${draft_count} rascunhos`,
    },
    {
      label: "Visualizações Totais",
      value: total_views.toLocaleString("pt-BR"),
      icon: Eye,
      color: "var(--rv-cyan)",
      sub: "todas as publicações",
    },
    {
      label: "Média por Post",
      value: total_articles > 0 ? (total_views / total_articles).toFixed(1) : "0",
      icon: TrendingUp,
      color: "var(--rv-gold)",
      sub: "visualizações / artigo",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="rv-card p-6 flex items-start gap-4">
            <div
              className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center"
              style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)` }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="rv-label text-[9px] text-[var(--rv-text-dim)] tracking-widest mb-1">{label.toUpperCase()}</p>
              <p className="rv-display text-3xl text-[var(--rv-text-primary)]">{value}</p>
              <p className="text-[11px] text-[var(--rv-text-dim)] mt-1">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Views chart */}
        <div className="rv-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--rv-accent) 15%, transparent)" }}>
              <Calendar className="h-4 w-4 text-[var(--rv-accent)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--rv-text-primary)]">Fluxo de Audiência</p>
              <p className="text-[11px] text-[var(--rv-text-muted)]">Visualizações nos últimos 15 dias</p>
            </div>
          </div>
          {views_by_date.length === 0 ? (
            <div className="flex items-center justify-center h-[240px] text-[var(--rv-text-dim)] text-sm">
              Nenhum dado disponível
            </div>
          ) : (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={views_by_date}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--rv-accent)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--rv-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--rv-border)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => {
                      try { return format(new Date(d), "dd/MM"); } catch { return d; }
                    }}
                    stroke="var(--rv-text-dim)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    dy={8}
                  />
                  <YAxis
                    stroke="var(--rv-text-dim)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--rv-surface)",
                      border: "1px solid var(--rv-border)",
                      borderRadius: "12px",
                      color: "var(--rv-text-primary)",
                      fontSize: "12px",
                    }}
                    labelFormatter={(l) => {
                      try { return format(new Date(String(l ?? '')), "dd 'de' MMMM yyyy", { locale: ptBR }); } catch { return String(l ?? ''); }
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Visualizações"
                    stroke="var(--rv-accent)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorViews)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top posts */}
        <div className="rv-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--rv-gold) 15%, transparent)" }}>
              <BarChart2 className="h-4 w-4 text-[var(--rv-gold)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--rv-text-primary)]">Top Performance</p>
              <p className="text-[11px] text-[var(--rv-text-muted)]">Posts com maior engajamento</p>
            </div>
          </div>

          {most_viewed.length === 0 ? (
            <div className="flex items-center justify-center h-[240px] text-[var(--rv-text-dim)] text-sm">
              Nenhum post publicado ainda
            </div>
          ) : (
            <div className="space-y-3">
              {most_viewed.map((article, index) => (
                <Link
                  key={article.id}
                  href={`/blog/${article.slug}`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--rv-surface-2)] transition-colors group"
                >
                  <span className="rv-display text-lg text-[var(--rv-text-dim)] w-6 text-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <p className="flex-1 text-sm text-[var(--rv-text-primary)] truncate group-hover:text-[var(--rv-accent)] transition-colors">
                    {article.title}
                  </p>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-semibold text-[var(--rv-text-primary)]">{article.total_views}</p>
                      <p className="rv-label text-[8px] text-[var(--rv-text-dim)]">TOTAL</p>
                    </div>
                    <div
                      className="text-right px-2 py-1 rounded-lg"
                      style={{ background: "color-mix(in srgb, var(--rv-gold) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--rv-gold) 20%, transparent)" }}
                    >
                      <p className="text-xs font-semibold text-[var(--rv-gold)]">+{article.views_last_30_days}</p>
                      <p className="rv-label text-[8px] text-[var(--rv-gold)]/70">30D</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
