export default function ForumCategoryLoading() {
  return (
    <div className="relative min-h-screen animate-pulse">
      {/* Hero */}
      <section className="border-b border-[var(--rv-border)] bg-gradient-to-b from-[var(--rv-surface)]/80 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20 sm:px-6 lg:px-8">
          <div className="flex gap-2 mb-6">
            <div className="h-3 w-14 rounded bg-[var(--rv-surface-2)]" />
            <div className="h-3 w-4 rounded bg-[var(--rv-surface-2)]" />
            <div className="h-3 w-24 rounded bg-[var(--rv-surface-2)]" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-[var(--rv-surface-2)]" />
            <div className="space-y-3">
              <div className="h-5 w-24 rounded-full bg-[var(--rv-surface-2)]" />
              <div className="h-10 w-64 rounded-lg bg-[var(--rv-surface-2)]" />
              <div className="h-3 w-80 rounded bg-[var(--rv-surface-2)]" />
            </div>
          </div>
          <div className="mt-10 flex gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 w-24 rounded-2xl bg-[var(--rv-surface-2)]" />
            ))}
          </div>
        </div>
      </section>

      {/* Topics + sidebar */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:py-16 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-8 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-[var(--rv-surface-2)]" />
          ))}
        </div>
        <aside className="lg:col-span-4 space-y-4">
          <div className="h-48 rounded-2xl bg-[var(--rv-surface-2)]" />
          <div className="h-40 rounded-2xl bg-[var(--rv-surface-2)]" />
          <div className="h-32 rounded-2xl bg-[var(--rv-surface-2)]" />
        </aside>
      </div>
    </div>
  );
}
