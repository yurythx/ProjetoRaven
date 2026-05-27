"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import {
  BookOpen,
  MessageSquare,
  Users,
  ShieldCheck,
  Mail,
  Activity,
  ShieldAlert,
  BarChart2,
  KeyRound,
  ClipboardCheck,
} from "lucide-react";

const CARDS = [
  {
    title: "Blog",
    desc: "Gestão completa de artigos e publicações.",
    href: "/blog",
    icon: BookOpen,
    color: "var(--rv-accent)",
    role: "editor"
  },
  {
    title: "Moderação",
    desc: "Controle de comentários e interações.",
    href: "/dashboard/blog/comentarios",
    icon: MessageSquare,
    color: "var(--rv-cyan)",
    role: "editor"
  },
  {
    title: "Fila Editorial",
    desc: "Aprovar, rejeitar e revisar posts pendentes.",
    href: "/dashboard/blog",
    icon: ClipboardCheck,
    color: "var(--rv-accent)",
    role: "editor"
  },
  {
    title: "Fórum",
    desc: "Supervisão de tópicos e denúncias.",
    href: "/dashboard/forum",
    icon: ShieldAlert,
    color: "var(--rv-gold)",
    role: "moderator"
  },
  {
    title: "Usuários",
    desc: "Administração de heróis e permissões.",
    href: "/dashboard/usuarios",
    icon: Users,
    color: "var(--rv-accent)",
    role: "admin"
  },
  {
    title: "Auditoria",
    desc: "Histórico detalhado de ações no sistema.",
    href: "/dashboard/auditoria",
    icon: ShieldCheck,
    color: "var(--rv-text-muted)",
    role: "admin"
  },
  {
    title: "E-mail (SMTP)",
    desc: "Configuração de entregabilidade e testes.",
    href: "/dashboard/configuracoes/email",
    icon: Mail,
    color: "var(--rv-cyan)",
    role: "admin"
  },
  {
    title: "Diagnósticos",
    desc: "Status de saúde do motor Raven.",
    href: "/dashboard/configuracoes/diagnosticos",
    icon: Activity,
    color: "var(--rv-gold)",
    role: "admin"
  },
  {
    title: "Analytics",
    desc: "Métricas de crescimento, jogadores e conteúdo.",
    href: "/dashboard/analytics",
    icon: BarChart2,
    color: "var(--rv-accent)",
    role: "admin"
  },
  {
    title: "Login Social",
    desc: "Configure OAuth com Google e Discord.",
    href: "/dashboard/configuracoes/oauth",
    icon: KeyRound,
    color: "var(--rv-gold)",
    role: "admin"
  }
];

export function DashboardCards() {
  const { user, isLoading } = useAuth();
  const u = (user ?? null) as Record<string, unknown> | null;
  const isAdmin = Boolean(u?.is_admin || u?.is_staff || u?.is_superuser) && !isLoading;
  const isModerator = Boolean(u?.is_forum_moderator || u?.is_blog_editor || isAdmin) && !isLoading;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {CARDS.map((card) => {
        const hasAccess = 
          card.role === "admin" ? isAdmin :
          card.role === "moderator" ? isModerator :
          true; // "editor" or open
        
        if (!hasAccess) return null;

        return (
          <Link 
            key={card.title} 
            href={card.href} 
            className="rv-card group p-6 sm:p-8 flex flex-col gap-4 hover:scale-[1.03] transition-all duration-300"
          >
            <div className="flex items-start justify-between">
              <div 
                className="h-12 w-12 rounded-2xl flex items-center justify-center border border-white/5 bg-white/5 group-hover:scale-110 transition-transform duration-500"
                style={{ color: card.color }}
              >
                <card.icon className="h-6 w-6" />
              </div>
              <div className="rv-label text-[8px] opacity-20 uppercase tracking-widest font-bold">Portal</div>
            </div>
            
            <div className="space-y-2">
              <h3 className="rv-display text-xl text-[var(--rv-text-primary)] group-hover:text-[var(--rv-accent)] transition-colors">{card.title}</h3>
              <p className="text-xs text-[var(--rv-text-muted)] leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
                {card.desc}
              </p>
            </div>

            <div className="rv-divider opacity-10" />
            
            <div className="flex items-center justify-between text-[var(--rv-text-dim)]">
              <span className="text-[10px] uppercase tracking-tighter opacity-50 font-bold group-hover:opacity-100 transition-opacity">Acessar Módulo</span>
              <span className="text-[var(--rv-accent)] group-hover:translate-x-2 transition-transform duration-300">→</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
