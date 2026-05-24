export default function BlogPostLoading() {
  return (
    <div className="relative min-h-screen animate-pulse">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-16 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="flex gap-2 mb-10">
          <div className="h-3 w-16 rounded bg-[var(--rv-surface-2)]" />
          <div className="h-3 w-4 rounded bg-[var(--rv-surface-2)]" />
          <div className="h-3 w-32 rounded bg-[var(--rv-surface-2)]" />
        </div>

        {/* Hero image */}
        <div className="h-56 sm:h-72 rounded-2xl bg-[var(--rv-surface-2)] mb-8" />

        {/* Title + meta */}
        <div className="space-y-4 mb-10">
          <div className="h-5 w-28 rounded-full bg-[var(--rv-surface-2)]" />
          <div className="h-12 w-full rounded-lg bg-[var(--rv-surface-2)]" />
          <div className="h-12 w-3/4 rounded-lg bg-[var(--rv-surface-2)]" />
          <div className="flex gap-3 mt-4">
            <div className="h-8 w-8 rounded-full bg-[var(--rv-surface-2)]" />
            <div className="h-3 w-28 rounded bg-[var(--rv-surface-2)] mt-2" />
            <div className="h-3 w-20 rounded bg-[var(--rv-surface-2)] mt-2 ml-4" />
          </div>
        </div>

        {/* Article body */}
        <div className="space-y-3">
          {[100, 95, 88, 100, 72, 90, 100, 60, 85, 100, 78, 92].map((w, i) => (
            <div
              key={i}
              className="h-4 rounded bg-[var(--rv-surface-2)]"
              style={{ width: `${w}%` }}
            />
          ))}
          {/* Paragraph break */}
          <div className="h-6" />
          {[100, 88, 95, 70, 100, 82].map((w, i) => (
            <div
              key={`b-${i}`}
              className="h-4 rounded bg-[var(--rv-surface-2)]"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
