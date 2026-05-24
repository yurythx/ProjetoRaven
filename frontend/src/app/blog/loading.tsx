export default function BlogLoading() {
  return (
    <div className="relative min-h-screen animate-pulse">
      {/* Hero skeleton */}
      <section className="border-b border-[var(--rv-border)] bg-gradient-to-b from-[var(--rv-surface)]/80 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:py-24 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
            <div className="space-y-4">
              <div className="h-5 w-32 rounded-full bg-[var(--rv-surface-2)]" />
              <div className="h-16 w-80 rounded-lg bg-[var(--rv-surface-2)]" />
              <div className="h-4 w-96 rounded bg-[var(--rv-surface-2)]" />
              <div className="h-4 w-72 rounded bg-[var(--rv-surface-2)]" />
            </div>
            <div className="h-11 w-36 rounded-xl bg-[var(--rv-surface-2)]" />
          </div>
          {/* Stats */}
          <div className="mt-12 flex gap-4">
            {[100, 100, 100].map((w, i) => (
              <div key={i} className="h-16 rounded-2xl bg-[var(--rv-surface-2)]" style={{ width: w }} />
            ))}
          </div>
        </div>
      </section>

      {/* Grid content */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:py-16 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Main */}
        <div className="lg:col-span-8 space-y-10">
          {/* Search bar */}
          <div className="h-12 rounded-xl bg-[var(--rv-surface-2)]" />

          {/* Article cards 2-col */}
          <div className="grid gap-6 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-[var(--rv-surface-2)] overflow-hidden">
                <div className="h-44 bg-[var(--rv-surface-2)]" />
                <div className="p-6 space-y-3">
                  <div className="h-3 w-24 rounded bg-[var(--rv-border)]" />
                  <div className="h-5 w-full rounded bg-[var(--rv-border)]" />
                  <div className="h-5 w-3/4 rounded bg-[var(--rv-border)]" />
                  <div className="h-3 w-full rounded bg-[var(--rv-border)]" />
                  <div className="h-3 w-2/3 rounded bg-[var(--rv-border)]" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl bg-[var(--rv-surface-2)] h-64" />
          <div className="rounded-2xl bg-[var(--rv-surface-2)] h-48" />
        </aside>
      </div>
    </div>
  );
}
