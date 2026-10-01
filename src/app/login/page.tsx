"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { authSchema } from "@/lib/validation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const nextPath = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/properties";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors;
      setErrors({
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrors({ general: error.message || "Invalid email or password." });
        setLoading(false);
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setErrors({ general: "An unexpected network error occurred. Please try again." });
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Column: Login Form */}
      <div className="lg:col-span-7 bg-surface border border-ink-200 p-6 sm:p-8">
        <div className="border-b border-ink-200 pb-4 mb-6">
          <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
            RETURNING TENANT
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 mt-1">
            Open your register.
          </h1>
          <p className="text-xs text-ink-600 mt-1">
            Your properties, areas and dated photographs are where you left them.
          </p>
        </div>

        {errors.general && (
          <div className="mb-5 p-3 text-xs bg-damage-bg border border-damage-border text-damage">
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tenant@example.com"
              autoComplete="email"
              disabled={loading}
              className={`w-full px-3 py-2 text-xs border bg-page focus:bg-surface focus:outline-none transition-colors ${
                errors.email
                  ? "border-damage focus:border-damage"
                  : "border-ink-200 focus:border-accent"
              }`}
            />
            {errors.email && (
              <p className="text-[11px] text-damage mt-1 font-mono">{errors.email}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-mono font-medium text-ink-700 uppercase tracking-wider">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[10px] font-mono text-ink-500 hover:text-ink-900 uppercase underline"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
              className={`w-full px-3 py-2 text-xs border bg-page focus:bg-surface focus:outline-none transition-colors ${
                errors.password
                  ? "border-damage focus:border-damage"
                  : "border-ink-200 focus:border-accent"
              }`}
            />
            {errors.password && (
              <p className="text-[11px] text-damage mt-1 font-mono">{errors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 btn-motion lit-dark"
          >
            {loading ? "Opening register..." : "Log in"}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-ink-100 flex items-center justify-between text-xs">
          <span className="text-ink-600">Need a fresh record?</span>
          <Link
            href="/signup"
            className="text-accent hover:underline font-semibold font-mono text-[11px] uppercase"
          >
            Open a new record →
          </Link>
        </div>

        <div className="mt-4 pt-3 border-t border-ink-100 text-[9px] font-mono text-ink-400">
          INTACT © 2026 — RECORDS CONDITION, NOT LIABILITY
        </div>
      </div>

      {/* Right Column: Register Extract (Matching Lovable Reference) */}
      <div className="lg:col-span-5 bg-page border border-ink-200 p-6 sm:p-8 space-y-4">
        <div className="border-b border-ink-200 pb-3">
          <span className="text-[10px] font-mono uppercase text-ink-500 tracking-wider block">
            REGISTER EXTRACT · SAMPLE
          </span>
          <h2 className="text-xs font-mono font-bold text-ink-900 mt-0.5 uppercase">
            Dated Area Register
          </h2>
        </div>

        <div className="divide-y divide-ink-200 text-xs font-mono">
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-ink-900">01 Entrance — door & frame</span>
            <span className="text-[10px] text-accent font-semibold uppercase bg-accent-tint px-1.5 py-0.5 border border-accent-border">
              MOVE-IN RECORDED
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-ink-900">02 Living room — east wall</span>
            <span className="text-[10px] text-accent font-semibold uppercase bg-accent-tint px-1.5 py-0.5 border border-accent-border">
              MOVE-IN RECORDED
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-ink-900">03 Bedroom — north wall</span>
            <span className="text-[10px] text-wear font-semibold uppercase bg-wear-bg px-1.5 py-0.5 border border-wear-border">
              COMPARED · 3 FINDINGS
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-ink-900">07 Kitchen — counter</span>
            <span className="text-[10px] text-wear font-semibold uppercase bg-wear-bg px-1.5 py-0.5 border border-wear-border">
              COMPARED · 2 FINDINGS
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-ink-900">09 Kitchen — floor</span>
            <span className="text-[10px] text-ink-500 font-semibold uppercase bg-surface px-1.5 py-0.5 border border-ink-200">
              MOVE-OUT NEEDED
            </span>
          </div>
        </div>

        <p className="text-xs text-ink-600 leading-relaxed pt-3 border-t border-ink-200">
          Every photograph in Intact belongs to an area, a stage and a timestamp. That is the whole idea: a record you can read two years later.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
      <Suspense fallback={<div className="p-8 text-center text-xs text-ink-500 font-mono">Loading authentication register...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

