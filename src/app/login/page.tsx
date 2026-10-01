"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { authSchema } from "@/lib/validation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/properties";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="bg-surface border border-ink-200 p-6 sm:p-8">
      <div className="border-b border-ink-200 pb-4 mb-6">
        <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
          AUTHENTICATION REGISTER
        </div>
        <h1 className="text-xl font-bold tracking-tight text-ink-900 mt-1">
          Sign In to Intact
        </h1>
        <p className="text-xs text-ink-600 mt-1">
          Access your property tenancy condition records.
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
          <label className="block text-[11px] font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
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
          {loading ? "Authenticating..." : "Sign In to Record"}
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-ink-100 text-center text-xs text-ink-600">
        Do not have an account?{" "}
        <Link
          href="/signup"
          className="text-accent hover:underline font-semibold"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="max-w-md mx-auto px-4 py-16 sm:py-24">
      <Suspense fallback={<div className="p-8 text-center text-xs text-ink-500 font-mono">Loading authentication form...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
