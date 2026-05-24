import Link from "next/link";
import type { Metadata } from "next";
import { HeroCta } from "@/components/hero-cta";
import { JsonLd } from "@/components/json-ld";
import { getSiteBaseUrl } from "@/lib/env";

export const metadata: Metadata = {
  title: "Projeto Raven — Blog & Fórum",
  description: "Seu espaço central para explorar artigos técnicos, participar de fóruns de discussão e interagir com uma comunidade apaixonada por tecnologia.",
  openGraph: {
    title: "Projeto Raven — Blog & Fórum",
    description: "Artigos, fórum e comunidade.",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "Projeto Raven — Blog & Fórum",
    description: "Artigos, fórum e comunidade.",
  },
};

const features = [
  {
    icon: "✦",
    badge: "Blog",
    badgeClass: "rv-badge-purple",
    title: "Blog",
    description: "Artigos, atualizações e conteúdo curado pela nossa equipe.",
    href: "/blog",
  },
  {
    icon: "◈",
    badge: "Community",
    badgeClass: "rv-badge-cyan",
    title: "Fórum",
    description: "Discussões, suporte e interação constante entre os membros.",
    href: "/forum",
  },
  {
    icon: "🛡️",
    badge: "Profile",
    badgeClass: "rv-badge-gold",
    title: "Sua Conta",
    description: "Gerencie seu perfil, configurações e seu histórico de atividades.",
    href: "/me",
  },
  {
    icon: "📷",
    badge: "Uploads",
    badgeClass: "rv-badge-red",
    title: "Mídia",
    description: "Faça upload e gerencie suas imagens, arquivos e avatares facilmente.",
    href: "/me",
  },
];

export default function Home() {
  const base = getSiteBaseUrl();
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Projeto Raven",
    url: base,
    description: "Blog, fórum e comunidade.",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${base}/blog?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Projeto Raven",
    url: base,
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <JsonLd data={websiteSchema} />
      <JsonLd data={orgSchema} />
      {/* ── Ambient background orbs ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-orb rv-animate-pulse-glow" style={{ width: "600px", height: "600px", top: "-10%", left: "-15%", background: "var(--rv-accent)" }} />
        <div className="rv-orb rv-animate-pulse-glow" style={{ width: "400px", height: "400px", bottom: "-5%", right: "-10%", background: "var(--rv-cyan)", animationDelay: "1.5s" }} />
        <div className="rv-orb" style={{ width: "300px", height: "300px", top: "40%", right: "20%", background: "var(--rv-accent-2)", opacity: 0.2 }} />
      </div>

      {/* ── Hero Section ── */}
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-center px-4 text-center">
        {/* Hex grid decorative element */}
        <div className="pointer-events-none absolute inset-0 opacity-5"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpath d='M28 66L0 50V18L28 2l28 16v32L28 66zm0-2l26-15V19L28 4 2 19v30l26 15z' fill='none' stroke='%238b5cf6' stroke-width='1'/%3E%3C/svg%3E\")" }}
        />

        <div className="relative z-10 max-w-5xl px-4 sm:px-6">
          <div className="mb-6 sm:mb-8 inline-flex">
            <span className="rv-badge rv-badge-purple">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--rv-accent)] animate-pulse" />
              Plataforma Online
            </span>
          </div>

          <h1 className="rv-display text-[clamp(3rem,12vw,10rem)] text-[var(--rv-text-primary)] mb-4 sm:mb-6">
            PROJETO<br />
            <span className="rv-text-gradient">RAVEN</span>
          </h1>

          <p className="text-[var(--rv-text-muted)] text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-3 sm:mb-4 px-2" style={{ fontFamily: "var(--font-body)" }}>
            Seu espaço central para explorar artigos técnicos, participar de fóruns de discussão e interagir com uma comunidade apaixonada por tecnologia.
          </p>
          <p className="rv-label text-[var(--rv-accent)] mb-10 sm:mb-14 tracking-[0.3em] sm:tracking-[0.5em] text-[8px] sm:text-[10px]">
            ✦ CONHECIMENTO · CONEXÃO · COMUNIDADE ✦
          </p>

          <HeroCta />
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <span className="rv-label text-[9px] tracking-[0.4em]">Explorar</span>
          <div className="h-12 w-6 rounded-full border border-white/20 flex items-start justify-center p-1.5">
            <div className="h-2 w-1 rounded-full bg-[var(--rv-accent)] rv-animate-float" />
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="relative z-10 border-y border-[var(--rv-border)] bg-[var(--rv-surface)]/50 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--rv-border)]">
          {[
            { val: "150+", label: "Artigos" },
            { val: "3,400+",  label: "Tópicos" },
            { val: "12,000+",  label: "Membros" },
            { val: "JWT",  label: "Auth API" },
          ].map((s) => (
            <div key={s.label} className="py-5 px-4 sm:py-6 sm:px-8 text-center">
              <div className="rv-display text-lg sm:text-2xl text-[var(--rv-accent)]">{s.val}</div>
              <div className="rv-label text-[8px] sm:text-[9px] text-[var(--rv-text-dim)] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:py-28 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <span className="rv-badge rv-badge-cyan mb-4 sm:mb-6 inline-flex">✦ Funcionalidades</span>
          <h2 className="rv-display text-3xl sm:text-4xl md:text-5xl text-[var(--rv-text-primary)]">
            O Ecossistema Completo
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2">
          {features.map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="rv-card group p-8 flex flex-col gap-4 hover:scale-[1.01] transition-transform duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="h-14 w-14 rounded-2xl bg-[var(--rv-surface-2)] border border-[var(--rv-border)] flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <span className={`rv-badge ${f.badgeClass}`}>{f.badge}</span>
              </div>
              <div>
                <h3 className="rv-display text-xl text-[var(--rv-text-primary)] mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--rv-text-muted)] leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
                  {f.description}
                </p>
              </div>
              <div className="mt-auto flex items-center gap-2 text-[var(--rv-accent)] rv-label text-[10px]">
                Explorar <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── CTA Footer ── */}
      <section className="relative z-10 border-t border-[var(--rv-border)] bg-[var(--rv-surface)]/30">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <span className="rv-badge rv-badge-gold mb-8 inline-flex">🤝 Conecte-se conosco</span>
          <h2 className="rv-display text-4xl md:text-6xl text-[var(--rv-text-primary)] mb-6">
            Sua jornada começa<br />
            <span className="rv-text-accent">aqui.</span>
          </h2>
          <p className="text-[var(--rv-text-muted)] mb-10 text-lg" style={{ fontFamily: "var(--font-body)" }}>
            Crie sua conta para participar das discussões e interagir com os criadores de conteúdo.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register" className="rv-btn rv-btn-primary px-12 h-14">
              Criar Conta Gratuita
            </Link>
            <Link href="/login" className="rv-btn rv-btn-ghost px-8 h-14">
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-[var(--rv-border)] py-12">
        <div className="mx-auto max-w-7xl px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[var(--rv-accent)] to-[var(--rv-cyan)]" />
            <span className="rv-display tracking-wider text-[var(--rv-text-primary)]">PROJETO RAVEN</span>
          </div>
          <div className="flex gap-8 rv-label text-[10px] text-[var(--rv-text-dim)]">
            <Link href="/forum" className="hover:text-[var(--rv-accent)] transition-colors">Fórum</Link>
            <Link href="/blog" className="hover:text-[var(--rv-accent)] transition-colors">Blog</Link>
            <Link href="/termos" className="hover:text-[var(--rv-accent)] transition-colors">Termos</Link>
            <Link href="/privacidade" className="hover:text-[var(--rv-accent)] transition-colors">Privacidade</Link>
          </div>
          <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">
            © 2026 Projeto Raven — All Rights Reserved
          </span>
        </div>
      </footer>
    </div>
  );
}
