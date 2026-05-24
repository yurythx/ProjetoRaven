export default function PublicProfileLoading() {
  return (
    <div className="relative min-h-screen animate-pulse">
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 sm:py-16 sm:px-6">
        {/* Hero header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-10">
          <div className="h-20 w-20 rounded-2xl bg-[var(--rv-surface-2)] flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-3 w-20 rounded-full bg-[var(--rv-surface-2)]" />
            <div className="h-10 w-56 rounded-lg bg-[var(--rv-surface-2)]" />
            <div className="h-3 w-48 rounded bg-[var(--rv-surface-2)]" />
          </div>
        </div>

        {/* Stats bar */}
        <div className="rounded-2xl bg-[var(--rv-surface-2)] p-5 mb-8 grid grid-cols-3 divide-x divide-[var(--rv-border)]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2 py-1">
              <div className="h-4 w-4 rounded bg-[var(--rv-border)]" />
              <div className="h-6 w-10 rounded-lg bg-[var(--rv-border)]" />
              <div className="h-2 w-16 rounded bg-[var(--rv-border)]" />
            </div>
          ))}
        </div>

        <div className="space-y-8">
          {/* Forum topics section */}
          <div>
            <div className="h-3 w-40 rounded bg-[var(--rv-surface-2)] mb-4" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-[var(--rv-surface-2)] p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-3/4 rounded bg-[var(--rv-border)]" />
                    <div className="h-2.5 w-1/3 rounded bg-[var(--rv-border)]" />
                  </div>
                  <div className="h-3 w-8 rounded bg-[var(--rv-border)]" />
                </div>
              ))}
            </div>
          </div>

          {/* Blog posts section */}
          <div>
            <div className="h-3 w-32 rounded bg-[var(--rv-surface-2)] mb-4" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-[var(--rv-surface-2)] p-4 flex items-center gap-4">
                  <div className="h-12 w-16 rounded-lg bg-[var(--rv-border)] flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-2/3 rounded bg-[var(--rv-border)]" />
                    <div className="h-2.5 w-24 rounded bg-[var(--rv-border)]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
