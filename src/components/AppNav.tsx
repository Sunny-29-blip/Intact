"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

interface AppNavProps {
  initialUser?: { email: string | null } | null;
  initialRole?: string | null;
  initialIsDemo?: boolean;
}

export function AppNav({ initialUser = null, initialRole = null, initialIsDemo = false }: AppNavProps) {
  const [user, setUser] = useState<{ email: string | null } | null>(initialUser);
  const [role, setRole] = useState<string | null>(initialRole);
  const [isDemo, setIsDemo] = useState<boolean>(initialIsDemo);
  const router = useRouter();
  const pathname = usePathname();

  // Sync props if changed from server
  useEffect(() => {
    setUser(initialUser);
    setRole(initialRole);
    setIsDemo(initialIsDemo);
  }, [initialUser, initialRole, initialIsDemo]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser({ email: session.user.email || null });
        setIsDemo(Boolean(session.user.app_metadata?.is_demo));
        fetch("/api/profile")
          .then((r) => (r.ok ? r.json() : null))
          .then((body) => {
            if (body?.data?.role) setRole(body.data.role);
          })
          .catch(() => {});
      } else {
        setUser(null);
        setRole(null);
        setIsDemo(false);
      }
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setIsDemo(false);
    router.push("/login");
    router.refresh();
  };

  const isOwner = role === "owner";
  const registerHref = isOwner ? "/owner" : "/properties";
  const isRegisterActive = isOwner ? pathname.startsWith("/owner") : pathname.startsWith("/properties");

  return (
    <>
      <header className="border-b border-ink-200 bg-surface sticky top-0 z-40">
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
        {/* Left Side: Brand Logo & Navigation Links */}
        <div className="flex items-center space-x-6">
          <Link
            href={user ? (isOwner ? "/owner" : "/properties") : "/"}
            className="flex items-center space-x-2.5 text-ink-900 font-bold tracking-tight text-base group"
          >
            <span className="w-2.5 h-2.5 bg-accent rounded-none inline-block"></span>
            <span className="font-sans tracking-wide">INTACT</span>
            <span className="text-ink-400 font-mono font-normal text-xs">—</span>
            <span className="text-[10px] font-mono font-normal text-ink-500 uppercase tracking-wider">
              {user && isOwner ? "OWNER REGISTER" : "INSPECTION RECORD"}
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 text-xs font-mono uppercase tracking-wider">
            {user ? (
              // LOGGED IN NAV
              <>
                <Link
                  href={registerHref}
                  className={`px-3 py-1.5 transition-colors border lit ${
                    isRegisterActive
                      ? "bg-page border-ink-200 text-ink-900 font-semibold"
                      : "border-transparent text-ink-600 hover:text-ink-900 hover:border-ink-100"
                  }`}
                >
                  {isOwner ? "Dashboard" : "Properties"}
                </Link>
                <Link
                  href="/report"
                  className={`px-3 py-1.5 transition-colors border lit ${
                    pathname === "/report"
                      ? "bg-page border-ink-200 text-ink-900 font-semibold"
                      : "border-transparent text-ink-600 hover:text-ink-900 hover:border-ink-100"
                  }`}
                >
                  Report
                </Link>
                <Link
                  href="/profile"
                  className={`px-3 py-1.5 transition-colors border lit ${
                    pathname.startsWith("/profile")
                      ? "bg-page border-ink-200 text-ink-900 font-semibold"
                      : "border-transparent text-ink-600 hover:text-ink-900 hover:border-ink-100"
                  }`}
                >
                  Profile
                </Link>
              </>
            ) : (
              // LOGGED OUT NAV (Page Anchors Only)
              <>
                <Link
                  href="/#example"
                  className="px-3 py-1.5 text-ink-600 hover:text-ink-900 transition-colors border border-transparent hover:border-ink-100"
                >
                  Example
                </Link>
                <Link
                  href="/#how-it-works"
                  className="px-3 py-1.5 text-ink-600 hover:text-ink-900 transition-colors border border-transparent hover:border-ink-100"
                >
                  How it works
                </Link>
                <Link
                  href="/#limits"
                  className="px-3 py-1.5 text-ink-600 hover:text-ink-900 transition-colors border border-transparent hover:border-ink-100"
                >
                  Limits
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Right Side: Auth Buttons */}
        <div className="flex items-center space-x-3 text-xs font-mono">
          {user ? (
            <div className="flex items-center space-x-3">
              <Link
                href="/profile"
                className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 text-[11px] text-ink-700 bg-page border border-ink-200 hover:border-ink-400 truncate max-w-xs"
              >
                <span className="truncate">{user.email}</span>
                {role && (
                  <span className="text-[9px] uppercase font-bold text-accent bg-accent-tint px-1 py-0.2 border border-accent-border">
                    {role}
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 uppercase tracking-wider text-xs text-ink-700 hover:text-ink-900 border border-ink-200 hover:border-ink-400 bg-surface transition-colors btn-motion lit"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2.5">
              <Link
                href="/login"
                className="h-11 sm:h-10 min-h-[44px] sm:min-h-[40px] px-4 py-2 inline-flex items-center justify-center rounded-[6px] font-sans font-medium text-[14px] text-[#373B41] bg-transparent border border-[#D1D5DB] hover:bg-white hover:border-[#9CA3AF] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D4A]"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="h-11 sm:h-10 min-h-[44px] sm:min-h-[40px] px-4 py-2 inline-flex items-center justify-center rounded-[6px] font-sans font-medium text-[14px] text-[#0B3D4A] bg-[#E0F0F3] border border-[rgba(11,61,74,0.22)] hover:bg-[color-mix(in_srgb,#0B3D4A_12%,white)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D4A]"
              >
                Start a record
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
    {isDemo && (
      <div className="bg-page border-b border-ink-200 py-1.5 px-4 text-center text-xs font-mono text-ink-600">
        Demo account. All data and photos here are samples.
      </div>
    )}
  </>
  );
}
