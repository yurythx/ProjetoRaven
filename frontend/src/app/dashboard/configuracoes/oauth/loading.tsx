export default function OAuthSettingsLoading() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 animate-pulse">
      {/* Header */}
      <div className="space-y-4 mb-10">
        <div className="h-5 w-36 rounded-full bg-[var(--rv-surface-2)]" />
        <div className="flex items-end justify-between gap-4">
          <div className="h-14 w-72 rounded-lg bg-[var(--rv-surface-2)]" />
          <div className="h-9 w-28 rounded-xl bg-[var(--rv-surface-2)]" />
        </div>
        <div className="h-3 w-full max-w-lg rounded bg-[var(--rv-surface-2)]" />
        <div className="h-3 w-80 rounded bg-[var(--rv-surface-2)]" />
      </div>

      {/* Provider cards */}
      <div className="space-y-6">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl bg-[var(--rv-surface-2)] overflow-hidden">
            {/* Card header */}
            <div className="p-6 border-b border-[var(--rv-border)] flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-[var(--rv-border)]" />
                <div className="space-y-2">
                  <div className="h-5 w-20 rounded-lg bg-[var(--rv-border)]" />
                  <div className="h-4 w-32 rounded-full bg-[var(--rv-border)]" />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="h-14 w-20 rounded-xl bg-[var(--rv-border)]" />
                <div className="h-14 w-14 rounded-xl bg-[var(--rv-border)]" />
              </div>
            </div>

            {/* Card form */}
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <div className="h-2.5 w-48 rounded bg-[var(--rv-border)]" />
                <div className="flex gap-2">
                  <div className="h-9 flex-1 rounded-xl bg-[var(--rv-border)]" />
                  <div className="h-9 w-36 rounded-xl bg-[var(--rv-border)]" />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {[0, 1].map((j) => (
                  <div key={j} className="space-y-2">
                    <div className="h-2.5 w-20 rounded bg-[var(--rv-border)]" />
                    <div className="h-10 rounded-xl bg-[var(--rv-border)]" />
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-2 border-t border-[var(--rv-border)]">
                <div className="h-10 w-32 rounded-xl bg-[var(--rv-border)]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
