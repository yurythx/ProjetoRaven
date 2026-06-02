export default function DiagnosticsLoading() {
  const lineWidths = ["w-full", "w-[60%]", "w-[80%]", "w-[45%]", "w-[70%]", "w-[55%]", "w-[90%]", "w-[40%]", "w-[65%]", "w-[75%]", "w-[50%]", "w-[85%]"];
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
        {lineWidths.map((w, i) => (
          <div key={i} className={`h-3 rounded bg-[var(--rv-border)] ${w}`} />
        ))}
      </div>
    </div>
  );
}
