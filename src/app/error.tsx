"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error.digest || error.name);
  }, [error]);

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 sm:px-6 py-16">
      <div className="max-w-md w-full border border-ink-200 bg-surface p-8 text-center shadow-sm">
        <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider mb-2">
          SOMETHING WENT WRONG
        </div>
        <h1 className="text-xl font-bold tracking-tight text-ink-900 mb-2">
          This page did not load
        </h1>
        <p className="text-xs text-ink-600 leading-relaxed font-sans mb-6">
          Your records are safe. Try again, or go back to the homepage.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="w-full sm:w-auto px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors font-mono btn-motion lit-dark"
          >
            Try again
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto px-4 py-2 border border-ink-200 hover:border-ink-400 bg-surface text-ink-800 text-xs font-medium uppercase tracking-wider transition-colors font-mono btn-motion lit"
          >
            Intact Homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
