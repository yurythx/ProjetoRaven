export default function ForumModerationLoading() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 animate-pulse">
      {/* Header */}
      <div className="space-y-4 mb-10">
        <div className="h-5 w-24 rounded-full bg-[var(--rv-surface-2)]" />
        <div className="h-14 w-56 rounded-lg bg-[var(--rv-surface-2)]" />
        <div className="h-3 w-80 rounded bg-[var(--rv-surface-2)]" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 w-24 rounded-lg bg-[var(--rv-surface-2)]" />
        ))}
      </div>

      {/* Content rows */}
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-[var(--rv-surface-2)] p-5 flex items-start gap-4">
            <div className="h-8 w-8 rounded-full bg-[var(--rv-border)] flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-[var(--rv-border)]" />
              <div className="h-3 w-1/2 rounded bg-[var(--rv-border)]" />
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <div className="h-7 w-16 rounded-lg bg-[var(--rv-border)]" />
              <div className="h-7 w-16 rounded-lg bg-[var(--rv-border)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
