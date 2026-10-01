"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function AppNav() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkUserAndRole = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      if (data.user) {
        try {
          const res = await fetch("/api/profile");
          if (res.ok) {
            const body = await res.json();
            setRole(body.data?.role || "tenant");
          }
        } catch {
          setRole("tenant");
        }
      }
      setLoading(false);
    };

    checkUserAndRole();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        fetch("/api/profile")
          .then((r) => (r.ok ? r.json() : null))
          .then((body) => {
            if (body?.data?.role) setRole(body.data.role);
          })
          .catch(() => {});
      } else {
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const registerHref = role === "owner" ? "/owner" : "/properties";
  const isRegisterActive = role === "owner" ? pathname.startsWith("/owner") : pathname.startsWith("/properties");

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
              {role === "owner" ? "OWNER REGISTER" : "INSPECTION RECORD"}
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-1 text-xs font-mono uppercase tracking-wider">
            <Link
              href={registerHref}
              className={`px-3 py-1.5 transition-colors border lit ${
                isRegisterActive
                  ? "bg-page border-ink-200 text-ink-900 font-semibold"
                  : "border-transparent text-ink-600 hover:text-ink-900 hover:border-ink-100"
              }`}
            >
              {role === "owner" ? "Properties" : "Properties"}
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
            {user && (
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
            )}
          </nav>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          {loading ? (
            <div className="w-24 h-4 bg-page animate-pulse" />
          ) : user ? (
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
  );
}
