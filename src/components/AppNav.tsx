"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function AppNav() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // Hide nav on standalone inspection report pages
  if (pathname.startsWith("/report/")) {
    return null;
  }

  return (
    <header className="border-b border-ink-200 bg-surface sticky top-0 z-40">
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link
            href="/"
            className="flex items-center space-x-2.5 text-ink-900 font-bold tracking-tight text-base group"
          >
            <span className="w-2.5 h-2.5 bg-accent rounded-none inline-block"></span>
            <span className="font-sans tracking-wide">INTACT</span>
            <span className="text-ink-400 font-mono font-normal text-xs">—</span>
            <span className="text-[10px] font-mono font-normal text-ink-500 uppercase tracking-wider">
              INSPECTION RECORD
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-1 text-xs font-mono uppercase tracking-wider">
            <Link
              href="/properties"
              className={`px-3 py-1.5 transition-colors border lit ${
                pathname.startsWith("/properties")
                  ? "bg-page border-ink-200 text-ink-900 font-semibold"
                  : "border-transparent text-ink-600 hover:text-ink-900 hover:border-ink-100"
              }`}
            >
              Register
            </Link>
            <Link
              href="/properties"
              className="px-3 py-1.5 transition-colors border border-transparent text-ink-600 hover:text-ink-900 hover:border-ink-100 lit"
            >
              Comparison
            </Link>
            <Link
              href="/report/sample"
              className={`px-3 py-1.5 transition-colors border lit ${
                pathname.startsWith("/report")
                  ? "bg-page border-ink-200 text-ink-900 font-semibold"
                  : "border-transparent text-ink-600 hover:text-ink-900 hover:border-ink-100"
              }`}
            >
              Report
            </Link>
          </nav>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          {loading ? (
            <div className="w-24 h-4 bg-page animate-pulse" />
          ) : user ? (
            <div className="flex items-center space-x-3">
              <Link
                href="/properties"
                className="hidden sm:inline-block px-2.5 py-1 text-[11px] text-ink-700 bg-page border border-ink-200 hover:border-ink-400 truncate max-w-xs"
              >
                {user.email}
              </Link>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 uppercase tracking-wider text-xs text-ink-700 hover:text-ink-900 border border-ink-200 hover:border-ink-400 bg-surface transition-colors btn-motion lit"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                href="/login"
                className="px-3.5 py-2 uppercase tracking-wider text-[11px] text-ink-700 hover:text-ink-900 border border-ink-200 hover:border-ink-400 bg-surface transition-colors btn-motion lit"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 uppercase tracking-wider text-[11px] text-white bg-accent hover:bg-accent-hover transition-colors font-semibold btn-motion lit-dark"
              >
                Start a record
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
