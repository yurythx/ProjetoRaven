export default function ForumLoading() {
  return (
    <div className="relative min-h-screen animate-pulse">
      {/* Hero skeleton */}
      <section className="border-b border-[var(--rv-border)] bg-gradient-to-b from-[var(--rv-surface)]/80 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:py-24 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
            <div className="space-y-4">
              <div className="h-5 w-28 rounded-full bg-[var(--rv-surface-2)]" />
              <div className="h-16 w-72 rounded-lg bg-[var(--rv-surface-2)]" />
              <div className="h-4 w-80 rounded bg-[var(--rv-surface-2)]" />
            </div>
            <div className="h-11 w-36 rounded-xl bg-[var(--rv-surface-2)]" />
          </div>
          <div className="mt-12 flex gap-4">
            {[100, 100, 100].map((_, i) => (
              <div key={i} className="h-16 w-24 rounded-2xl bg-[var(--rv-surface-2)]" />
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:py-16 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Main */}
        <div className="lg:col-span-8 space-y-10">
          <div className="h-12 rounded-xl bg-[var(--rv-surface-2)]" />

          {/* Topic rows */}
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-[var(--rv-surface-2)]" />
            ))}
          </div>

          {/* Category grid */}
          <div>
            <div className="h-5 w-28 rounded-full bg-[var(--rv-surface-2)] mb-6" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-36 rounded-2xl bg-[var(--rv-surface-2)]" />
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="h-52 rounded-2xl bg-[var(--rv-surface-2)]" />
          <div className="h-44 rounded-2xl bg-[var(--rv-surface-2)]" />
          <div className="h-36 rounded-2xl bg-[var(--rv-surface-2)]" />
        </aside>
      </div>
    </div>
  );
}
