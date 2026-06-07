import Link from "next/link";

export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative z-10 border-t border-[var(--rv-border)] py-10 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-[var(--rv-accent)] to-[var(--rv-cyan)]" />
          <span className="rv-display tracking-wider text-[var(--rv-text-primary)] text-sm">PROJETO RAVEN</span>
        </div>

        <nav className="flex flex-wrap justify-center gap-6 rv-label text-[10px] text-[var(--rv-text-dim)]">
          <Link href="/blog" prefetch={false} className="hover:text-[var(--rv-accent)] transition-colors">Blog</Link>
          <Link href="/forum" prefetch={false} className="hover:text-[var(--rv-accent)] transition-colors">Fórum</Link>
          <Link href="/search" prefetch={false} className="hover:text-[var(--rv-accent)] transition-colors">Busca</Link>
          <Link href="/notifications" prefetch={false} className="hover:text-[var(--rv-accent)] transition-colors">Notificações</Link>
          <Link href="/termos" prefetch={false} className="hover:text-[var(--rv-accent)] transition-colors">Termos</Link>
          <Link href="/privacidade" prefetch={false} className="hover:text-[var(--rv-accent)] transition-colors">Privacidade</Link>
          <a href="/api/blog/rss" className="hover:text-[var(--rv-accent)] transition-colors flex items-center gap-1" target="_blank" rel="noopener noreferrer">
            RSS
          </a>
        </nav>

        <span className="rv-label text-[9px] text-[var(--rv-text-dim)]">
          © {year} Projeto Raven
        </span>
      </div>
    </footer>
  );
}
