import Link from "next/link";

export default function BlogNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="rv-badge rv-badge-purple inline-flex">404 — Não Encontrado</div>
      <h1 className="rv-display text-5xl text-[var(--rv-text-primary)]">404</h1>
      <p className="text-[var(--rv-text-muted)] max-w-sm" style={{ fontFamily: "var(--font-body)" }}>
        Este post não existe ou foi removido do diário do servidor.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link href="/blog" className="rv-btn rv-btn-primary px-8 h-11 text-xs">
          ← Voltar ao Blog
        </Link>
        <Link href="/" className="rv-btn rv-btn-ghost px-8 h-11 text-xs">
          Início
        </Link>
      </div>
    </div>
  );
}
