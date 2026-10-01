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

  // Don't render full nav on standalone report pages
  if (pathname.startsWith("/report/")) {
    return null;
  }

  return (
    <header className="border-b border-ink-200 bg-paper-50 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link
            href="/"
            className="flex items-center space-x-2 text-ink-900 font-semibold tracking-tight text-lg"
          >
            <span className="inline-block w-3 h-3 bg-accent rounded-xs"></span>
            <span>INTACT</span>
            <span className="text-xs font-mono uppercase px-1.5 py-0.5 border border-ink-200 rounded-xs text-ink-600">
              Evidence Engine
            </span>
          </Link>

          {user && (
            <nav className="hidden sm:flex items-center space-x-4 text-sm font-medium">
              <Link
                href="/properties"
                className={`px-2.5 py-1.5 rounded transition-colors ${
                  pathname.startsWith("/properties")
                    ? "bg-paper-200 text-ink-900 font-semibold"
                    : "text-ink-600 hover:text-ink-900"
                }`}
              >
                Properties
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center space-x-3 text-sm">
          {loading ? (
            <div className="w-16 h-4 bg-paper-200 animate-pulse rounded-xs" />
          ) : user ? (
            <div className="flex items-center space-x-3">
              <span className="hidden md:inline text-xs font-mono text-ink-600 px-2 py-1 bg-paper-100 border border-ink-100 rounded-xs">
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs font-medium text-ink-700 hover:text-ink-900 border border-ink-200 hover:border-ink-400 bg-white rounded transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                href="/login"
                className="px-3 py-1.5 text-xs font-medium text-ink-700 hover:text-ink-900 border border-ink-200 hover:border-ink-400 bg-white rounded transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded transition-colors"
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
