export default function EmailSettingsLoading() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 sm:py-24 animate-pulse">
      {/* Hero card */}
      <div className="bg-[var(--rv-surface-2)]/30 border border-white/5 p-8 sm:p-12 rounded-[2.5rem] mb-12 space-y-4">
        <div className="h-5 w-44 rounded-full bg-[var(--rv-surface-2)]" />
        <div className="h-14 w-64 rounded-lg bg-[var(--rv-surface-2)]" />
        <div className="h-4 w-96 rounded bg-[var(--rv-surface-2)]" />
      </div>

      <div className="grid gap-8">
        {/* Main config card */}
        <div className="rounded-2xl bg-[var(--rv-surface-2)] p-8 sm:p-10 space-y-8">
          {/* Status toggle section */}
          <div className="flex items-center justify-between border-b border-white/5 pb-8">
            <div className="space-y-2">
              <div className="h-5 w-40 rounded-lg bg-[var(--rv-border)]" />
              <div className="h-3 w-56 rounded bg-[var(--rv-border)]" />
            </div>
            <div className="h-14 w-32 rounded-2xl bg-[var(--rv-border)]" />
          </div>

          {/* Connection fields */}
          <div>
            <div className="h-2.5 w-20 rounded bg-[var(--rv-border)] mb-4" />
            <div className="grid gap-5 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-2.5 w-20 rounded bg-[var(--rv-border)]" />
                  <div className="h-11 rounded-xl bg-[var(--rv-border)]" />
                </div>
              ))}
            </div>
          </div>

          {/* Security fields */}
          <div>
            <div className="h-2.5 w-20 rounded bg-[var(--rv-border)] mb-4" />
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-[var(--rv-border)]" />
              ))}
            </div>
          </div>

          {/* Sender fields */}
          <div className="pt-6 border-t border-white/5">
            <div className="h-2.5 w-24 rounded bg-[var(--rv-border)] mb-4" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-2.5 w-16 rounded bg-[var(--rv-border)]" />
                  <div className="h-11 rounded-xl bg-[var(--rv-border)]" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <div className="h-11 w-44 rounded-xl bg-[var(--rv-border)]" />
          </div>
        </div>

        {/* Test card */}
        <div className="rounded-2xl bg-[var(--rv-surface-2)] p-8 sm:p-10 space-y-4">
          <div className="h-6 w-48 rounded-lg bg-[var(--rv-border)]" />
          <div className="h-3 w-72 rounded bg-[var(--rv-border)]" />
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="h-11 flex-1 rounded-xl bg-[var(--rv-border)]" />
            <div className="h-11 w-32 rounded-xl bg-[var(--rv-border)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
