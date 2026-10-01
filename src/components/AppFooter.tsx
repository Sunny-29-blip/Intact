"use client";

import Link from "next/link";
import type { UserRole } from "@/types/database";

interface AppFooterProps {
  isAuthenticated?: boolean;
  userRole?: UserRole | null;
}

export function AppFooter({
  isAuthenticated = false,
  userRole = "tenant",
}: AppFooterProps) {
  const isOwner = userRole === "owner";

  return (
    <footer className="border-t border-ink-200 bg-surface mt-auto no-print">
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-10 pb-10 border-b border-ink-200">
          {/* Brand Info */}
          <div className="md:col-span-6 space-y-3">
            <Link
              href="/"
              className="flex items-center space-x-2.5 text-ink-900 font-bold tracking-tight text-base"
            >
              <span className="w-2.5 h-2.5 bg-accent inline-block"></span>
              <span className="font-sans tracking-wide">INTACT</span>
              <span className="text-ink-400 font-mono font-normal text-xs">—</span>
              <span className="text-[10px] font-mono font-normal text-ink-500 uppercase tracking-wider">
                INSPECTION RECORD
              </span>
            </Link>
            <p className="text-xs sm:text-sm text-ink-600 max-w-sm leading-relaxed font-sans">
              A dated photographic record of the place you rent, from the day you move in to the day you hand back the keys.
            </p>
          </div>

          {/* Navigation Links Columns */}
          <div className="md:col-span-2">
            <h4 className="text-[10px] font-mono uppercase tracking-wider text-ink-500 font-bold mb-3">
              {isAuthenticated ? "Workspace" : "Explore"}
            </h4>
            <ul className="space-y-2.5 text-xs font-sans">
              {isAuthenticated ? (
                <>
                  <li>
                    <Link
                      href={isOwner ? "/owner" : "/properties"}
                      className="text-ink-600 hover:text-ink-900 transition-colors"
                    >
                      {isOwner ? "Owner Properties" : "Tenant Register"}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/report"
                      className="text-ink-600 hover:text-ink-900 transition-colors"
                    >
                      Two-photo check
                    </Link>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link
                      href="/#example"
                      className="text-ink-600 hover:text-ink-900 transition-colors"
                    >
                      Real example
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/#how-it-works"
                      className="text-ink-600 hover:text-ink-900 transition-colors"
                    >
                      How it works
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/#limits"
                      className="text-ink-600 hover:text-ink-900 transition-colors"
                    >
                      Scope of record
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          <div className="md:col-span-2">
            <h4 className="text-[10px] font-mono uppercase tracking-wider text-ink-500 font-bold mb-3">
              Reports
            </h4>
            <ul className="space-y-2.5 text-xs font-sans">
              <li>
                <Link
                  href="/report/sample"
                  className="text-ink-600 hover:text-ink-900 transition-colors"
                >
                  Sample report
                </Link>
              </li>
              {isAuthenticated ? (
                <li>
                  <Link
                    href="/report"
                    className="text-ink-600 hover:text-ink-900 transition-colors"
                  >
                    Run comparison
                  </Link>
                </li>
              ) : (
                <li>
                  <Link
                    href="/login"
                    className="text-ink-600 hover:text-ink-900 transition-colors"
                  >
                    Open your report
                  </Link>
                </li>
              )}
            </ul>
          </div>

          <div className="md:col-span-2">
            <h4 className="text-[10px] font-mono uppercase tracking-wider text-ink-500 font-bold mb-3">
              Account
            </h4>
            <ul className="space-y-2.5 text-xs font-sans">
              {isAuthenticated ? (
                <>
                  <li>
                    <Link
                      href="/profile"
                      className="text-ink-600 hover:text-ink-900 transition-colors"
                    >
                      Your Profile
                    </Link>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link
                      href="/login"
                      className="text-ink-600 hover:text-ink-900 transition-colors"
                    >
                      Log in
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/signup"
                      className="text-ink-600 hover:text-ink-900 transition-colors"
                    >
                      Sign up
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-ink-500">
          <span>INTACT © 2026</span>
          <span>Intact records condition. It does not assign liability.</span>
        </div>
      </div>
    </footer>
  );
}
