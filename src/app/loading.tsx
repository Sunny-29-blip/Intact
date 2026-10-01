export default function Loading() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12" aria-busy="true" aria-live="polite">
      <div className="border border-ink-200 bg-surface p-6 sm:p-8 animate-pulse space-y-4">
        <div className="h-5 bg-page w-1/4"></div>
        <div className="h-8 bg-page w-1/2"></div>
        <div className="h-4 bg-page w-1/3"></div>
      </div>
      <span className="sr-only">Loading…</span>
    </main>
  );
}
