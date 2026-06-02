export default function AuditLoading() {
  const tableHeaderWidths = ["w-[80px]", "w-[120px]", "w-[160px]", "w-[80px]", "w-[100px]"];
  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 animate-pulse">
      {/* Header */}
      <div className="space-y-4 mb-10">
        <div className="h-5 w-32 rounded-full bg-[var(--rv-surface-2)]" />
        <div className="h-14 w-64 rounded-lg bg-[var(--rv-surface-2)]" />
        <div className="h-3 w-96 rounded bg-[var(--rv-surface-2)]" />
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="h-9 w-40 rounded-xl bg-[var(--rv-surface-2)]" />
        <div className="h-9 w-32 rounded-xl bg-[var(--rv-surface-2)]" />
        <div className="h-9 w-28 rounded-xl bg-[var(--rv-surface-2)]" />
      </div>

      {/* Event rows */}
      <div className="rounded-2xl bg-[var(--rv-surface-2)] overflow-hidden">
        {/* Table header */}
        <div className="flex gap-4 px-6 py-3 border-b border-[var(--rv-border)]">
          {tableHeaderWidths.map((w, i) => (
            <div key={i} className={`h-2.5 rounded bg-[var(--rv-border)] ${w}`} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-6 py-4 border-b border-[var(--rv-border)]/50 last:border-0">
            <div className="h-3 w-20 rounded bg-[var(--rv-border)]" />
            <div className="h-3 w-28 rounded bg-[var(--rv-border)]" />
            <div className="h-3 flex-1 rounded bg-[var(--rv-border)]" />
            <div className="h-3 w-20 rounded bg-[var(--rv-border)]" />
            <div className="h-5 w-24 rounded-full bg-[var(--rv-border)]" />
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <div className="h-3 w-32 rounded bg-[var(--rv-surface-2)]" />
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-8 rounded-lg bg-[var(--rv-surface-2)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
