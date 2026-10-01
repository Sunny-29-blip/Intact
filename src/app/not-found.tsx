import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 sm:px-6 py-16">
      <div className="max-w-md w-full border border-ink-200 bg-surface p-8 text-center shadow-sm">
        <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider mb-2">
          DOCUMENT STATUS · 404
        </div>
        <div className="w-8 h-8 mx-auto bg-page border border-ink-300 flex items-center justify-center font-mono text-sm font-bold text-ink-700 mb-4">
          ∅
        </div>
        <h1 className="text-xl font-bold tracking-tight text-ink-900 mb-2">
          Record Not Found
        </h1>
        <p className="text-xs text-ink-600 leading-relaxed font-sans mb-6">
          The requested inspection record, area dossier, or resource could not be located in the register.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/properties"
            className="w-full sm:w-auto px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors font-mono btn-motion lit-dark"
          >
            Return to Register
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto px-4 py-2 border border-ink-200 hover:border-ink-400 bg-surface text-ink-800 text-xs font-medium uppercase tracking-wider transition-colors font-mono btn-motion lit"
          >
            Intact Homepage
          </Link>
        </div>
        <div className="mt-8 pt-4 border-t border-ink-100 text-[9px] font-mono text-ink-400 uppercase">
          INTACT © 2026 · ARCHIVAL VERIFICATION
        </div>
      </div>
    </main>
  );
}
