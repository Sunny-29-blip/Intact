"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppFooter() {
  const pathname = usePathname();

  // On report page, print view hides standard footer
  return (
    <footer className="border-t border-ink-200 bg-surface mt-auto no-print">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-8 pb-8 border-b border-ink-100">
          {/* Brand Info */}
          <div className="md:col-span-6 space-y-3">
            <Link
              href="/"
              className="flex items-center space-x-2 text-ink-900 font-bold tracking-tight text-sm"
            >
              <span className="w-2.5 h-2.5 bg-accent inline-block"></span>
              <span className="font-sans tracking-wide">INTACT</span>
              <span className="text-[10px] font-mono font-normal text-ink-500 uppercase px-1.5 py-0.5 border border-ink-200">
                Record
              </span>
            </Link>
            <p className="text-xs text-ink-600 max-w-sm leading-relaxed">
              A dated photographic record of the place you rent, from the day you move in to the day you hand back the keys.
            </p>
          </div>

          {/* Navigation Links Columns */}
          <div className="md:col-span-2">
            <h4 className="text-[10px] font-mono uppercase tracking-wider text-ink-500 font-bold mb-3">
              Record
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/properties" className="text-ink-600 hover:text-ink-900 transition-colors">
                  Register
                </Link>
              </li>
              <li>
                <Link href="/properties" className="text-ink-600 hover:text-ink-900 transition-colors">
                  Photo recording
                </Link>
              </li>
              <li>
                <Link href="/properties" className="text-ink-600 hover:text-ink-900 transition-colors">
                  Comparison
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <h4 className="text-[10px] font-mono uppercase tracking-wider text-ink-500 font-bold mb-3">
              Report
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/report/sample" className="text-ink-600 hover:text-ink-900 transition-colors">
                  Inspection report
                </Link>
              </li>
              <li>
                <Link href="/report/sample" className="text-ink-600 hover:text-ink-900 transition-colors">
                  Shared report
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <h4 className="text-[10px] font-mono uppercase tracking-wider text-ink-500 font-bold mb-3">
              Account
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/login" className="text-ink-600 hover:text-ink-900 transition-colors">
                  Log in
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-ink-600 hover:text-ink-900 transition-colors">
                  Sign up
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] font-mono text-ink-500">
          <span>INTACT © 2026 — RECORDS CONDITION, NOT LIABILITY</span>
          <span>A matching SHA-256 hash proves file integrity since upload.</span>
        </div>
      </div>
    </footer>
  );
}
