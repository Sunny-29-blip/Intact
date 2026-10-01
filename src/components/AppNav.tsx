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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link
            href="/"
            className="flex items-center space-x-2.5 text-ink-900 font-bold tracking-tight text-base group"
          >
            <span className="w-2.5 h-2.5 bg-accent rounded-none inline-block"></span>
            <span className="font-sans tracking-wide">INTACT</span>
            <span className="text-[11px] font-mono font-normal text-ink-500 uppercase px-1.5 py-0.5 border border-ink-200">
              Record
            </span>
          </Link>

          <nav className="hidden sm:flex items-center space-x-1 text-xs font-medium">
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

        <div className="flex items-center space-x-3 text-xs">
          {loading ? (
            <div className="w-24 h-4 bg-page animate-pulse" />
          ) : user ? (
            <div className="flex items-center space-x-3">
              <span className="hidden md:inline font-mono text-[11px] text-ink-600 px-2 py-0.5 bg-page border border-ink-200">
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 font-sans text-xs text-ink-700 hover:text-ink-900 border border-ink-200 hover:border-ink-400 bg-surface transition-colors btn-motion lit"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                href="/login"
                className="px-3 py-1.5 text-xs text-ink-700 hover:text-ink-900 border border-ink-200 hover:border-ink-400 bg-surface transition-colors btn-motion lit"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-3 py-1.5 text-xs text-white bg-accent hover:bg-accent-hover transition-colors font-medium btn-motion lit-dark"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
