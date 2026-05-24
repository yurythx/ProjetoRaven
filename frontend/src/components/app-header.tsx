"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

// ── Data ─────────────────────────────────────────────────────────────────────

const STATIC_LINKS = [
  { href: "/blog",  label: "Blog",  icon: "✦", authOnly: false },
  { href: "/forum", label: "Fórum", icon: "◈", authOnly: false },
];

// ── Main header ───────────────────────────────────────────────────────────────

export function AppHeader() {
  const { user, isLoading, logout } = useAuth();
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const u = (user ?? null) as Record<string, unknown> | null;
  const isLoggedIn = Boolean(user) && !isLoading;

  const unreadCount = 0;

  const isAdmin = Boolean(u?.is_admin);
  const isEditor = Boolean(u?.is_blog_editor);
  const isMod = Boolean(u?.is_forum_moderator);
  const canSeeDashboard = (isAdmin || isEditor || isMod) && !isLoading;
  const heroName = String(u?.display_name || u?.username || "Usuário");

  // Header transparente sobre fundo claro → trocar branco por preto
  const lightTransparent = resolvedTheme === "light" && !scrolled && !menuOpen;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Cores adaptativas por contexto
  const logoText    = lightTransparent ? "text-[var(--rv-black)]"        : "text-white";
  const navInactive = lightTransparent
    ? "text-[var(--rv-text-muted)] hover:text-[var(--rv-black)] hover:bg-black/5 border border-transparent"
    : "text-[var(--rv-text-muted)] hover:text-white hover:bg-white/5 border border-transparent";
  const mobileNavInactive = lightTransparent
    ? "text-[var(--rv-text-muted)] hover:text-[var(--rv-black)] hover:bg-black/5 border border-transparent"
    : "text-[var(--rv-text-muted)] hover:text-white hover:bg-white/5 border border-transparent";

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled || menuOpen
            ? "bg-black/72 backdrop-blur-3xl border-b border-[rgba(68,183,139,0.18)]"
            : "bg-transparent"
        }`}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--rv-accent)] to-transparent opacity-60" />

        <div className="mx-auto flex h-16 sm:h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

          {/* Logo */}
          <Link href="/" className="group flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="relative h-8 w-8 sm:h-9 sm:w-9">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[var(--rv-accent)] to-[var(--rv-cyan)] opacity-80 group-hover:opacity-100 transition-opacity rv-glow-purple" />
              <div className="absolute inset-[2px] rounded-[5px] bg-[var(--rv-black)] flex items-center justify-center">
                <span className="text-[var(--rv-accent)] font-black text-xs">R</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className={`rv-display text-base sm:text-lg leading-none tracking-wider transition-colors duration-300 ${logoText}`}>RAVEN</span>
              <span className="rv-label text-[7px] sm:text-[9px] text-[var(--rv-text-dim)] tracking-[0.35em]">PORTAL</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {STATIC_LINKS.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`group flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 rv-label text-xs ${
                    active
                      ? "bg-[var(--rv-accent-glow)] text-[var(--rv-accent)] border border-[var(--rv-border-hover)]"
                      : navInactive
                  }`}
                >
                  <span className={active ? "text-[var(--rv-accent)]" : "text-[var(--rv-text-dim)] group-hover:text-[var(--rv-accent)]"}>
                    {link.icon}
                  </span>
                  {link.label}
                </Link>
              );
            })}

            {/* Dashboard */}
            {canSeeDashboard && (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-4 py-2 rounded-xl rv-label text-xs text-[var(--rv-cyan)] hover:bg-[var(--rv-cyan-glow)] transition-all border border-transparent hover:border-[var(--rv-cyan)]/20"
              >
                <span>⬡</span>
                {isAdmin ? "Console" : "Panel"}
              </Link>
            )}
          </nav>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              aria-label="Buscar"
              onClick={() => router.push("/search")}
              className={`h-9 w-9 rounded-xl border border-[var(--rv-border)] flex items-center justify-center transition-all hover:border-[var(--rv-accent)]/40 hover:bg-[var(--rv-accent)]/10 ${pathname.startsWith("/search") ? "border-[var(--rv-accent)]/40 bg-[var(--rv-accent-glow)] text-[var(--rv-accent)]" : "text-[var(--rv-text-muted)]"}`}
            >
              <Search className="h-4 w-4" aria-hidden />
            </button>
            <ThemeToggle onDark={!lightTransparent} />
            {isLoading ? (
              <div className="h-4 w-16 animate-pulse rounded-full bg-white/10" />
            ) : !user ? (
              <>
                <Link href="/login" className="rv-btn rv-btn-ghost text-xs px-5 h-10">
                  Entrar
                </Link>
                <Link href="/register" className="rv-btn rv-btn-primary text-xs px-5 h-10">
                  Criar Conta
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/me"
                  className="rv-card flex items-center gap-2 px-3 py-1.5 hover:border-[var(--rv-border-hover)] transition-all"
                >
                  <div className="relative h-6 w-6 flex-shrink-0">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[var(--rv-accent)] to-[var(--rv-cyan)] flex items-center justify-center text-white font-black text-xs">
                      {heroName[0].toUpperCase()}
                    </div>
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-[var(--rv-red)] border border-[var(--rv-black)] flex items-center justify-center text-[8px] font-black text-white leading-none">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </div>
                  <span className="hidden lg:block text-sm font-semibold text-[var(--rv-text-primary)] max-w-[120px] truncate">
                    {heroName}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="h-9 w-9 rounded-xl border border-[var(--rv-border)] bg-[var(--rv-surface)] text-[var(--rv-text-muted)] hover:text-[var(--rv-red)] hover:border-[var(--rv-red)]/30 transition-all flex items-center justify-center"
                  title="Sair"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Mobile: right side */}
          <div className="flex md:hidden items-center gap-2">
            {!isLoading && !user && (
              <Link href="/login" className="rv-btn rv-btn-primary text-xs px-4 h-9">
                Entrar
              </Link>
            )}
            {!isLoading && user && (
              <Link href="/me" className="relative h-9 w-9 flex-shrink-0">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[var(--rv-accent)] to-[var(--rv-cyan)] flex items-center justify-center text-white font-black text-sm">
                  {heroName[0].toUpperCase()}
                </div>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[var(--rv-red)] border border-[var(--rv-black)] flex items-center justify-center text-[8px] font-black text-white leading-none">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            )}
            <ThemeToggle onDark={!lightTransparent} />
            {/* Hamburger */}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="h-9 w-9 rounded-xl border border-[var(--rv-border)] bg-[var(--rv-surface)] flex items-center justify-center transition-all hover:border-[var(--rv-border-hover)]"
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            >
              <div className="flex flex-col gap-1.5 w-4">
                <span className={`h-[2px] bg-[var(--rv-text-muted)] rounded-full transition-all duration-300 ${menuOpen ? "rotate-45 translate-y-[7px]" : ""}`} />
                <span className={`h-[2px] bg-[var(--rv-text-muted)] rounded-full transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} />
                <span className={`h-[2px] bg-[var(--rv-text-muted)] rounded-full transition-all duration-300 ${menuOpen ? "-rotate-45 -translate-y-[7px]" : ""}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ${menuOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
          <nav className="border-t border-[var(--rv-border)] px-4 py-4 flex flex-col gap-1">
            {STATIC_LINKS.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all rv-label text-xs ${
                    active
                      ? "bg-[var(--rv-accent-glow)] text-[var(--rv-accent)] border border-[var(--rv-border-hover)]"
                      : mobileNavInactive
                  }`}
                >
                  <span className={active ? "text-[var(--rv-accent)]" : "text-[var(--rv-text-dim)]"}>{link.icon}</span>
                  {link.label}
                </Link>
              );
            })}

            <Link
              href="/search"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all rv-label text-xs ${
                pathname.startsWith("/search")
                  ? "bg-[var(--rv-accent-glow)] text-[var(--rv-accent)] border border-[var(--rv-border-hover)]"
                  : mobileNavInactive
              }`}
            >
              <Search className="h-4 w-4" aria-hidden /> Buscar
            </Link>

            {canSeeDashboard && (
              <Link
                href="/dashboard"
                className="flex items-center gap-3 px-4 py-3 rounded-xl rv-label text-xs text-[var(--rv-cyan)] hover:bg-[var(--rv-cyan-glow)] transition-all border border-transparent"
              >
                <span>⬡</span>
                {isAdmin ? "Console" : "Panel"}
              </Link>
            )}

            {isLoggedIn && (
              <button
                type="button"
                onClick={() => void logout()}
                className="flex items-center gap-3 px-4 py-3 rounded-xl rv-label text-xs text-[var(--rv-red)] hover:bg-[var(--rv-red-glow)] transition-all w-full text-left border border-transparent mt-1"
              >
                <span>→</span> Sair
              </button>
            )}
            {!isLoading && !user && (
              <Link href="/register" className="rv-btn rv-btn-primary w-full h-11 mt-2 text-xs">
                Criar Conta Grátis
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Overlay for mobile menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
    </>
  );
}
