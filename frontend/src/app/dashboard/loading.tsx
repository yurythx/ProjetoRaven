export default function DashboardLoading() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 sm:py-24 animate-pulse">
      {/* Heading */}
      <div className="space-y-4 mb-16">
        <div className="h-5 w-36 rounded-full bg-[var(--rv-surface-2)]" />
        <div className="h-14 w-72 rounded bg-[var(--rv-surface-2)]" />
        <div className="h-4 w-96 rounded bg-[var(--rv-surface-2)]" />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-[var(--rv-surface-2)]" />
        ))}
      </div>
    </div>
  );
}
