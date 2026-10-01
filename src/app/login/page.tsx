"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { authSchema } from "@/lib/validation";
import { api } from "@/lib/api";
import { PasswordField } from "@/components/PasswordField";
import type { UserRole } from "@/types/database";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const nextPath = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;

  const [activeTab, setActiveTab] = useState<UserRole>("tenant");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [roleNotice, setRoleNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrors({});
    setRoleNotice(null);

    const trimmedEmail = email.trim();
    const validation = authSchema.safeParse({ email: trimmedEmail, password });
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
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (authError) {
        setLoading(false);
        const errorMsg = (authError.message || "").toLowerCase();
        const status = (authError as { status?: number }).status;
        if (status === 429 || errorMsg.includes("rate limit") || errorMsg.includes("too many requests")) {
          setErrors({ general: "Too many attempts. Wait a minute and try again." });
        } else {
          // Never reveal if email exists or password was wrong
          setErrors({
            general: "We couldn't find an account with that email and password. Check them, or create an account.",
          });
        }
        return;
      }

      // Read profile role from server API
      const profile = await api.getProfile().catch(() => ({ role: "tenant" as UserRole }));
      const userRole = profile.role || "tenant";

      if (userRole === "owner") {
        router.push("/owner");
        router.refresh();
      } else {
        router.push(nextPath || "/properties");
        router.refresh();
      }
    } catch {
      setErrors({ general: "A network error occurred. Please try again." });
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Column: Login Form */}
      <div className="lg:col-span-7 bg-surface border border-ink-200 p-6 sm:p-8">
        {/* Role Tabs */}
        <div className="flex border-b border-ink-200 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("tenant")}
            className={`pb-2.5 px-4 font-mono text-xs uppercase tracking-wider font-semibold border-b-2 transition-colors ${
              activeTab === "tenant"
                ? "border-accent text-ink-900"
                : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            For tenants
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("owner")}
            className={`pb-2.5 px-4 font-mono text-xs uppercase tracking-wider font-semibold border-b-2 transition-colors ${
              activeTab === "owner"
                ? "border-accent text-ink-900"
                : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            For owners
          </button>
        </div>

        <div className="border-b border-ink-200 pb-4 mb-6">
          <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
            {activeTab === "tenant" ? "RETURNING TENANT" : "PROPERTY OWNER"}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 mt-1">
            {activeTab === "tenant" ? "Open your register." : "Open your owner register."}
          </h1>
          <p className="text-xs text-ink-600 mt-1">
            {activeTab === "tenant"
              ? "Your properties, areas and dated photographs are where you left them."
              : "Manage your properties, generate join codes and view shared condition records."}
          </p>
        </div>

        {roleNotice && (
          <div className="mb-5 p-3 text-xs bg-page border border-ink-300 text-ink-800 font-mono">
            {roleNotice}
          </div>
        )}

        {errors.general && (
          <div className="mb-5 p-3 text-xs bg-page border border-ink-300 text-ink-800 flex items-center justify-between gap-3">
            <span>{errors.general}</span>
            {errors.general.includes("create an account") && (
              <Link
                href={`/signup${activeTab === "owner" ? "?role=owner" : ""}`}
                className="text-accent hover:underline font-semibold font-mono text-[11px] uppercase whitespace-nowrap"
              >
                Create account →
              </Link>
            )}
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
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="name@example.com"
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

          <PasswordField
            label="Password"
            value={password}
            onChange={(val) => {
              setPassword(val);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={errors.password}
            autoComplete="current-password"
            disabled={loading}
            required
          />

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
            href={`/signup${activeTab === "owner" ? "?role=owner" : ""}`}
            className="text-accent hover:underline font-semibold font-mono text-[11px] uppercase"
          >
            Open a new record →
          </Link>
        </div>

        <div className="mt-4 pt-3 border-t border-ink-100 text-[9px] font-mono text-ink-400">
          INTACT © 2026 — RECORDS CONDITION, NOT LIABILITY
        </div>
      </div>

      {/* Right Column: Register Extract */}
      <div className="lg:col-span-5 bg-page border border-ink-200 p-6 sm:p-8 space-y-4">
        <div className="border-b border-ink-200 pb-3">
          <span className="text-[10px] font-mono uppercase text-ink-500 tracking-wider block">
            {activeTab === "tenant" ? "TENANT REGISTER EXTRACT" : "OWNER PORTAL OVERVIEW"}
          </span>
          <h2 className="text-xs font-mono font-bold text-ink-900 mt-0.5 uppercase">
            {activeTab === "tenant" ? "Dated Area Register" : "Property Join Codes"}
          </h2>
        </div>

        {activeTab === "tenant" ? (
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
          </div>
        ) : (
          <div className="divide-y divide-ink-200 text-xs font-mono">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-ink-900">Flat 402 — Greenview</span>
              <span className="text-[10px] text-accent font-bold uppercase bg-surface px-2 py-0.5 border border-ink-300">
                CODE: K7M9X2PQ
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-ink-900">Villa 12 — Palm Grove</span>
              <span className="text-[10px] text-accent font-bold uppercase bg-surface px-2 py-0.5 border border-ink-300">
                CODE: B3N8W4TR
              </span>
            </div>
          </div>
        )}

        <p className="text-xs text-ink-600 leading-relaxed pt-3 border-t border-ink-200 font-sans">
          {activeTab === "tenant"
            ? "Every photograph in Intact belongs to an area, a stage and a timestamp. That is the whole idea: a record you can read two years later."
            : "Owners create properties and generate join codes. Tenants link their records and can choose to share condition reports upon move-in or move-out."}
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
