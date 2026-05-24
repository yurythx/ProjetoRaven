export default function UsersAdminLoading() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-16 sm:py-24 animate-pulse">
      {/* Hero card */}
      <div className="bg-[var(--rv-surface-2)]/30 border border-white/5 p-8 sm:p-12 rounded-[2.5rem] mb-12">
        <div className="space-y-4">
          <div className="h-5 w-36 rounded-full bg-[var(--rv-surface-2)]" />
          <div className="h-14 w-64 rounded-lg bg-[var(--rv-surface-2)]" />
          <div className="h-4 w-80 rounded bg-[var(--rv-surface-2)]" />
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="h-11 flex-1 min-w-48 rounded-xl bg-[var(--rv-surface-2)]" />
        <div className="h-11 w-32 rounded-xl bg-[var(--rv-surface-2)]" />
        <div className="h-11 w-28 rounded-xl bg-[var(--rv-surface-2)]" />
      </div>

      {/* User table */}
      <div className="rounded-2xl bg-[var(--rv-surface-2)] overflow-hidden">
        <div className="flex gap-4 px-6 py-3 border-b border-[var(--rv-border)]">
          {[200, 160, 80, 80, 100, 80].map((w, i) => (
            <div key={i} className="h-2.5 rounded bg-[var(--rv-border)]" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-[var(--rv-border)]/50 last:border-0">
            <div className="h-8 w-8 rounded-full bg-[var(--rv-border)] flex-shrink-0" />
            <div className="h-3 w-36 rounded bg-[var(--rv-border)] flex-1" />
            <div className="h-3 w-40 rounded bg-[var(--rv-border)]" />
            <div className="h-5 w-16 rounded-full bg-[var(--rv-border)]" />
            <div className="h-5 w-16 rounded-full bg-[var(--rv-border)]" />
            <div className="h-3 w-20 rounded bg-[var(--rv-border)]" />
            <div className="h-7 w-7 rounded-lg bg-[var(--rv-border)]" />
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <div className="h-3 w-28 rounded bg-[var(--rv-surface-2)]" />
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-8 rounded-lg bg-[var(--rv-surface-2)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
