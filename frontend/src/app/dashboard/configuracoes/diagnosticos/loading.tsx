export default function DiagnosticsLoading() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 animate-pulse">
      {/* Header */}
      <div className="space-y-4 mb-10">
        <div className="h-5 w-20 rounded-full bg-[var(--rv-surface-2)]" />
        <div className="flex items-end justify-between gap-4">
          <div className="h-14 w-56 rounded-lg bg-[var(--rv-surface-2)]" />
          <div className="h-9 w-28 rounded-xl bg-[var(--rv-surface-2)]" />
        </div>
        <div className="h-3 w-80 rounded bg-[var(--rv-surface-2)]" />
      </div>

      {/* JSON output card */}
      <div className="rounded-2xl bg-[var(--rv-surface-2)] p-6 space-y-3">
        {[100, 60, 80, 45, 70, 55, 90, 40, 65, 75, 50, 85].map((w, i) => (
          <div key={i} className="h-3 rounded bg-[var(--rv-border)]" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}
