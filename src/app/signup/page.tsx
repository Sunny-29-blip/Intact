"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { authSchema } from "@/lib/validation";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccessNotice(null);

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
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrors({ general: error.message || "Failed to create account." });
        setLoading(false);
        return;
      }

      // If user session is immediate (or auto-confirmed in Supabase)
      if (data.session) {
        router.push("/properties");
        router.refresh();
      } else {
        setSuccessNotice(
          "Account created. If email verification is enabled, please verify your email or sign in below."
        );
        setLoading(false);
      }
    } catch {
      setErrors({ general: "An unexpected network error occurred. Please try again." });
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 py-16 sm:py-24">
      <div className="bg-white border border-ink-200 rounded p-6 sm:p-8">
        <div className="border-b border-ink-100 pb-4 mb-6">
          <div className="text-xs font-mono uppercase text-ink-500 tracking-wider">
            Tenancy Evidence Record
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink-900 mt-1">
            Create an Account
          </h1>
          <p className="text-sm text-ink-600 mt-1">
            Start protecting your tenancy deposit with cryptographic evidence.
          </p>
        </div>

        {errors.general && (
          <div className="mb-5 p-3 text-xs bg-damage-bg border border-damage-border text-damage rounded">
            {errors.general}
          </div>
        )}

        {successNotice && (
          <div className="mb-5 p-3 text-xs bg-accepted-bg border border-accepted-border text-accepted rounded">
            {successNotice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-700 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tenant@example.com"
              disabled={loading}
              className={`w-full px-3 py-2 text-sm border rounded bg-paper-50 focus:bg-white focus:outline-none transition-colors ${
                errors.email
                  ? "border-damage focus:border-damage"
                  : "border-ink-200 focus:border-accent"
              }`}
            />
            {errors.email && (
              <p className="text-xs text-damage mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-700 uppercase tracking-wider mb-1">
              Password (min 6 characters)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className={`w-full px-3 py-2 text-sm border rounded bg-paper-50 focus:bg-white focus:outline-none transition-colors ${
                errors.password
                  ? "border-damage focus:border-damage"
                  : "border-ink-200 focus:border-accent"
              }`}
            />
            {errors.password && (
              <p className="text-xs text-damage mt-1">{errors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-ink-100 text-center text-xs text-ink-600">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-accent hover:underline font-medium"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
