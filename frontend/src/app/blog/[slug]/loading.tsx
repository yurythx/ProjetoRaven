export default function BlogPostLoading() {
  const lineWidthsA = ["w-full", "w-[95%]", "w-[88%]", "w-full", "w-[72%]", "w-[90%]", "w-full", "w-[60%]", "w-[85%]", "w-full", "w-[78%]", "w-[92%]"];
  const lineWidthsB = ["w-full", "w-[88%]", "w-[95%]", "w-[70%]", "w-full", "w-[82%]"];
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
          {lineWidthsA.map((w, i) => (
            <div
              key={i}
              className={`h-4 rounded bg-[var(--rv-surface-2)] ${w}`}
            />
          ))}
          {/* Paragraph break */}
          <div className="h-6" />
          {lineWidthsB.map((w, i) => (
            <div
              key={`b-${i}`}
              className={`h-4 rounded bg-[var(--rv-surface-2)] ${w}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
