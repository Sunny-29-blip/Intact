"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { authSchema } from "@/lib/validation";
import { api } from "@/lib/api";
import { PasswordField } from "@/components/PasswordField";
import type { UserRole } from "@/types/database";

export default function SignupPage() {
  const router = useRouter();

  const [roleTab, setRoleTab] = useState<UserRole>("tenant");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (errors.password) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.password;
        return next;
      });
    }
    if (confirmPassword && val === confirmPassword && errors.confirmPassword) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.confirmPassword;
        return next;
      });
    }
  };

  const handleConfirmPasswordChange = (val: string) => {
    setConfirmPassword(val);
    if (errors.confirmPassword && (val === password || !val)) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.confirmPassword;
        return next;
      });
    }
  };

  const handleConfirmBlur = () => {
    if (confirmPassword && password !== confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: "Passwords do not match",
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrors({});

    const trimmedEmail = email.trim();

    // 1. Validate matching passwords
    if (password !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match" });
      return;
    }

    // 2. Validate format and minimum 8 chars
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
      // 3. Call Supabase signUp (no emailRedirectTo)
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: name.trim() || undefined,
          },
        },
      });

      if (error) {
        setLoading(false);
        const errorMsg = (error.message || "").toLowerCase();
        if (
          errorMsg.includes("already registered") ||
          errorMsg.includes("already exists") ||
          (error as { code?: string }).code === "user_already_exists"
        ) {
          setErrors({
            general: "An account with this email already exists. Log in instead.",
          });
        } else if (errorMsg.includes("at least") || errorMsg.includes("password")) {
          setErrors({
            password: error.message,
          });
        } else {
          setErrors({ general: error.message || "Failed to create account." });
        }
        return;
      }

      // Supabase returns identities: [] when email exists and email confirmation is enabled
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setLoading(false);
        setErrors({
          general: "An account with this email already exists. Log in instead.",
        });
        return;
      }

      let activeSession = data.session;

      // If signUp returns a user but no session, immediately call signInWithPassword
      if (!activeSession) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (signInError) {
          setLoading(false);
          const signInMsg = (signInError.message || "").toLowerCase();
          if (
            signInMsg.includes("email not confirmed") ||
            signInMsg.includes("confirm your email") ||
            (signInError as { code?: string }).code === "email_not_confirmed"
          ) {
            setErrors({
              general:
                "Your account was created, but the project still requires email confirmation. Turn off 'Confirm email' in the Supabase settings.",
            });
          } else {
            setErrors({ general: signInError.message || "Failed to establish session." });
          }
          return;
        }

        activeSession = signInData.session;
      }

      if (!activeSession) {
        setLoading(false);
        setErrors({
          general:
            "Your account was created, but the project still requires email confirmation. Turn off 'Confirm email' in the Supabase settings.",
        });
        return;
      }

      // Create the profile record server-side with selected role
      await api.createProfile({
        role: roleTab,
        display_name: name.trim() || undefined,
      }).catch((err) => {
        console.error("Profile creation error:", err);
      });

      // Go straight to the role's home
      const destination = roleTab === "owner" ? "/owner" : "/properties";
      router.push(destination);
      router.refresh();
    } catch {
      setErrors({ general: "A network error occurred. Please try again." });
      setLoading(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Signup Form */}
        <div className="lg:col-span-7 bg-surface border border-ink-200 p-6 sm:p-8">
          {/* Role Tabs */}
          <div className="flex border-b border-ink-200 mb-6 font-mono text-xs">
            <button
              type="button"
              onClick={() => {
                setRoleTab("tenant");
                setErrors({});
              }}
              className={`pb-3 px-4 uppercase tracking-wider font-semibold border-b-2 -mb-px transition-colors ${
                roleTab === "tenant"
                  ? "border-accent text-accent font-bold"
                  : "border-transparent text-ink-500 hover:text-ink-900"
              }`}
            >
              For tenants
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleTab("owner");
                setErrors({});
              }}
              className={`pb-3 px-4 uppercase tracking-wider font-semibold border-b-2 -mb-px transition-colors ${
                roleTab === "owner"
                  ? "border-accent text-accent font-bold"
                  : "border-transparent text-ink-500 hover:text-ink-900"
              }`}
            >
              For owners
            </button>
          </div>

          <div className="border-b border-ink-200 pb-4 mb-6">
            <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
              {roleTab === "tenant" ? "TENANT REGISTRATION · 01" : "OWNER REGISTRATION · 01"}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-900 mt-1">
              {roleTab === "tenant"
                ? "Open your tenant inspection record."
                : "Open your property owner register."}
            </h1>
            <p className="text-xs text-ink-600 mt-1">
              {roleTab === "tenant"
                ? "One account holds every property you rent. Photographs stay yours and are never sent to a landlord unless you share a report."
                : "Register your rental properties, generate join codes for tenants, and review shared condition reports in one place."}
            </p>
          </div>

          {errors.general && (
            <div className="mb-5 p-3 text-xs bg-page border border-ink-300 text-ink-800 flex items-center justify-between gap-3">
              <span>{errors.general}</span>
              {errors.general.includes("Log in instead") && (
                <Link
                  href="/login"
                  className="text-accent hover:underline font-semibold font-mono text-[11px] uppercase whitespace-nowrap"
                >
                  Log in →
                </Link>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                Full Name (Optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={roleTab === "tenant" ? "e.g. Rahul Sharma" : "e.g. Vikram Mehta"}
                autoComplete="name"
                disabled={loading}
                className="w-full px-3 py-2 text-xs border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent transition-colors"
              />
              <p className="text-[10px] font-mono text-ink-500 mt-1">
                {roleTab === "tenant"
                  ? "Appears on issued reports."
                  : "Appears on property registers shared with tenants."}
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                Email Address <span className="text-damage">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={roleTab === "tenant" ? "tenant@example.com" : "owner@example.com"}
                autoComplete="email"
                disabled={loading}
                className={`w-full px-3 py-2 text-xs border bg-page focus:bg-surface focus:outline-none transition-colors ${
                  errors.email
                    ? "border-damage focus:border-damage"
                    : "border-ink-200 focus:border-accent"
                }`}
              />
              {errors.email ? (
                <p className="text-[11px] text-damage mt-1 font-mono">{errors.email}</p>
              ) : (
                <p className="text-[10px] font-mono text-ink-500 mt-1">
                  Used to sign in and recover your account.
                </p>
              )}
            </div>

            <PasswordField
              label="Password"
              value={password}
              onChange={handlePasswordChange}
              error={errors.password}
              hint="At least 8 characters. No reuse from another service."
              autoComplete="new-password"
              disabled={loading}
              required
            />

            <PasswordField
              label="Confirm Password"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              onBlur={handleConfirmBlur}
              error={errors.confirmPassword}
              autoComplete="new-password"
              disabled={loading}
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 btn-motion lit-dark"
            >
              {loading
                ? "Creating account..."
                : roleTab === "tenant"
                ? "Open tenant record"
                : "Open owner register"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-ink-100 flex items-center justify-between text-xs">
            <span className="text-ink-600">Existing account?</span>
            <Link
              href="/login"
              className="text-accent hover:underline font-semibold font-mono text-[11px] uppercase"
            >
              I already have an account →
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
              {roleTab === "tenant" ? "REGISTER EXTRACT · TENANT VIEW" : "REGISTER EXTRACT · OWNER VIEW"}
            </span>
            <h2 className="text-xs font-mono font-bold text-ink-900 mt-0.5 uppercase">
              {roleTab === "tenant" ? "Dated Area Register" : "Property & Tenancy Links"}
            </h2>
          </div>

          {roleTab === "tenant" ? (
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
          ) : (
            <div className="divide-y divide-ink-200 text-xs font-mono">
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-ink-900 font-semibold">Flat 402, Oakwood Towers</div>
                  <div className="text-[10px] text-ink-500">CODE: 8F2K9M4X · 1 TENANT</div>
                </div>
                <span className="text-[10px] text-accepted font-semibold uppercase bg-accepted-bg px-1.5 py-0.5 border border-accepted-border">
                  REPORT SHARED
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-ink-900 font-semibold">Villa 12, Palm Meadows</div>
                  <div className="text-[10px] text-ink-500">CODE: 3N7P6T2W · 1 TENANT</div>
                </div>
                <span className="text-[10px] text-ink-500 font-semibold uppercase bg-surface px-1.5 py-0.5 border border-ink-200">
                  NOT SHARED
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-ink-900 font-semibold">Studio 3B, Cyber Heights</div>
                  <div className="text-[10px] text-ink-500">CODE: 9L4X7Q1R · 0 TENANTS</div>
                </div>
                <span className="text-[10px] text-ink-400 font-semibold uppercase bg-surface px-1.5 py-0.5 border border-ink-200">
                  AWAITING LINK
                </span>
              </div>
            </div>
          )}

          <p className="text-xs text-ink-600 leading-relaxed pt-3 border-t border-ink-200">
            {roleTab === "tenant"
              ? "Every photograph in Intact belongs to an area, a stage and a timestamp. That is the whole idea: a record you can read two years later."
              : "Owners register their property once to generate an unambiguous join code. Tenants link to this code and control when to share read-only condition reports."}
          </p>
        </div>
      </div>
    </main>
  );
}
