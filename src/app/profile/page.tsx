"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { api, ApiError } from "@/lib/api";
import { updateProfileSchema } from "@/lib/validation";
import type { Profile, PropertyListItem, OwnerProperty } from "@/types/database";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Name editing
  const [displayName, setDisplayName] = useState("");
  const [contact, setContact] = useState({ phone: "", address_line: "", city: "", state: "", pincode: "" });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Role specific context data
  const [tenantProperties, setTenantProperties] = useState<PropertyListItem[]>([]);
  const [ownerProperties, setOwnerProperties] = useState<OwnerProperty[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setEmail(user.email || null);
      }

      const prof = await api.getProfile();
      setProfile(prof);
      setDisplayName(prof.display_name || "");
      setContact({
        phone: prof.phone || "",
        address_line: prof.address_line || "",
        city: prof.city || "",
        state: prof.state || "",
        pincode: prof.pincode || "",
      });

      if (prof.role === "tenant") {
        const props = await api.getProperties().catch(() => []);
        setTenantProperties(props);
      } else if (prof.role === "owner") {
        const props = await api.getOwnerProperties().catch(() => []);
        setOwnerProperties(props);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load user profile.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    const payload = {
      display_name: displayName.trim() || null,
      phone: contact.phone.trim() || null,
      address_line: contact.address_line.trim() || null,
      city: contact.city.trim() || null,
      state: contact.state.trim() || null,
      pincode: contact.pincode.trim() || null,
    };
    const validation = updateProfileSchema.safeParse(payload);

    if (!validation.success) {
      const firstError = Object.values(validation.error.flatten().fieldErrors).flat()[0];
      setSaveError(firstError || "Check the details and try again.");
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateProfile(payload);
      setProfile(updated);
      setDisplayName(updated.display_name || "");
      setContact({
        phone: updated.phone || "",
        address_line: updated.address_line || "",
        city: updated.city || "",
        state: updated.state || "",
        pincode: updated.pincode || "",
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.message);
      } else {
        setSaveError("We could not save your details. Try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="border-b border-ink-200 pb-5 mb-8">
        <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
          ACCOUNT SETTINGS · PROFILE
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-900 mt-1">
          User Profile & Credentials
        </h1>
        <p className="text-xs text-ink-600 mt-1">
          Manage your account display identity and review your role-specific associations.
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-damage-bg border border-damage-border text-xs text-damage flex items-center justify-between font-mono">
          <span>[!] {error}</span>
          <button
            onClick={loadData}
            className="underline font-semibold hover:text-damage ml-4 btn-motion"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="border border-ink-200 bg-surface p-6 sm:p-8 animate-pulse space-y-4">
          <div className="h-5 bg-page w-1/4"></div>
          <div className="h-8 bg-page w-1/2"></div>
          <div className="h-4 bg-page w-1/3"></div>
        </div>
      )}

      {!loading && profile && (
        <div className="space-y-8">
          {/* Identity & Account Card */}
          <div className="bg-surface border border-ink-200 p-6 sm:p-8">
            <div className="border-b border-ink-200 pb-4 mb-6">
              <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                PRIMARY IDENTITY
              </div>
              <h2 className="text-base font-bold text-ink-900 mt-0.5">
                Account Information
              </h2>
            </div>

            {saveSuccess && (
              <div className="mb-4 p-3 bg-accepted-bg border border-accepted-border text-accepted font-mono text-xs">
                [✓] Your details were saved.
              </div>
            )}

            {saveError && (
              <div className="mb-4 p-3 bg-damage-bg border border-damage-border text-damage font-mono text-xs">
                [!] {saveError}
              </div>
            )}

            <div className="space-y-6 text-xs">
              {/* Email (Read-only) */}
              <div>
                <label className="block font-mono text-[10px] uppercase text-ink-500 mb-1">
                  Email Address (Read-only)
                </label>
                <div className="px-3 py-2 border border-ink-200 bg-page text-ink-700 font-mono text-xs select-all">
                  {email || "—"}
                </div>
                <p className="text-[10px] font-mono text-ink-400 mt-1">
                  Your email is managed securely by Supabase authentication.
                </p>
              </div>

              {/* Role (Read-only) */}
              <div>
                <label className="block font-mono text-[10px] uppercase text-ink-500 mb-1">
                  Account Role (Enforced on Server)
                </label>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block px-3 py-1 text-xs font-mono uppercase font-bold border ${
                      profile.role === "owner"
                        ? "bg-accent-tint text-accent border-accent-border"
                        : "bg-surface text-ink-800 border-ink-300"
                    }`}
                  >
                    {profile.role === "owner" ? "PROPERTY OWNER" : "TENANT"}
                  </span>
                  <span className="text-[11px] text-ink-500 font-mono">
                    {profile.role === "owner"
                      ? "Can create properties, generate join codes, and inspect shared tenant condition reports."
                      : "Can record arrival/departure photos, generate condition reports, and link to owner properties."}
                  </span>
                </div>
              </div>

              {/* Display Name (Editable) */}
              <form onSubmit={handleUpdateName} className="pt-4 border-t border-ink-100 space-y-3">
                <div>
                  <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    disabled={saving}
                    className="w-full px-3 py-2 border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent font-sans text-xs"
                  />
                  <p className="text-[10px] font-mono text-ink-500 mt-1">
                    {profile.role === "owner"
                      ? "Appears on property registers shared with tenants."
                      : "Appears on inspection reports generated for landlords."}
                  </p>
                </div>

                {([
                  ["phone", "Phone", "e.g. +91 98765 43210", "tel"],
                  ["address_line", "Address", "Flat, building, street", "text"],
                  ["city", "City", "e.g. Bengaluru", "text"],
                  ["state", "State", "e.g. Karnataka", "text"],
                  ["pincode", "PIN code", "e.g. 560001", "text"],
                ] as const).map(([key, label, placeholder, type]) => (
                  <div key={key}>
                    <label
                      htmlFor={`profile-${key}`}
                      className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1"
                    >
                      {label}
                    </label>
                    <input
                      id={`profile-${key}`}
                      type={type}
                      inputMode={key === "pincode" ? "numeric" : undefined}
                      value={contact[key]}
                      onChange={(e) => setContact((c) => ({ ...c, [key]: e.target.value }))}
                      placeholder={placeholder}
                      disabled={saving}
                      className="w-full px-3 py-2 border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent font-sans text-xs"
                    />
                  </div>
                ))}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold uppercase tracking-wider font-mono text-xs transition-colors disabled:opacity-40 btn-motion lit-dark"
                  >
                    {saving ? "Saving..." : "Save details"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Role-Specific Overview */}
          <div className="bg-surface border border-ink-200 p-6 sm:p-8">
            <div className="border-b border-ink-200 pb-4 mb-6 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                  ROLE OVERVIEW · {profile.role.toUpperCase()}
                </div>
                <h2 className="text-base font-bold text-ink-900 mt-0.5">
                  {profile.role === "owner" ? "Your properties" : "Your flats"}
                </h2>
              </div>
              <Link
                href={profile.role === "owner" ? "/owner" : "/properties"}
                className="text-xs font-mono text-accent hover:underline uppercase font-semibold"
              >
                Go to Dashboard →
              </Link>
            </div>

            {profile.role === "owner" ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-page border border-ink-200">
                    <div className="text-[10px] font-mono uppercase text-ink-500">
                      TOTAL PROPERTIES REGISTERED
                    </div>
                    <div className="text-2xl font-bold font-mono text-ink-900 mt-1">
                      {ownerProperties.length}
                    </div>
                  </div>
                  <div className="p-4 bg-page border border-ink-200">
                    <div className="text-[10px] font-mono uppercase text-ink-500">
                      TOTAL LINKED TENANTS
                    </div>
                    <div className="text-2xl font-bold font-mono text-ink-900 mt-1">
                      {ownerProperties.reduce((acc, p) => acc + (p.linked_tenants_count || 0), 0)}
                    </div>
                  </div>
                </div>

                {ownerProperties.length > 0 && (
                  <div className="border border-ink-200 divide-y divide-ink-100 mt-4">
                    {ownerProperties.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 flex items-center justify-between hover:bg-page transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-ink-900">{p.name}</div>
                          <div className="text-[10px] font-mono text-ink-500">
                            CODE: {p.join_code} {p.city ? `· ${p.city}` : ""}
                          </div>
                        </div>
                        <Link
                          href={`/owner/properties/${p.id}`}
                          className="text-xs font-mono text-accent hover:underline font-semibold"
                        >
                          Edit →
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {tenantProperties.length === 0 ? (
                  <div className="p-6 bg-page border border-dashed border-ink-200 text-center font-mono text-ink-500">
                    No flats added yet. Add one from your Properties page.
                  </div>
                ) : (
                  <div className="border border-ink-200 divide-y divide-ink-100">
                    {tenantProperties.map((p) => (
                      <div
                        key={p.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-page transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-ink-900">{p.name}</div>
                          {p.address && (
                            <div className="text-[11px] text-ink-600 mt-0.5">{p.address}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {p.linked_owner_property && (
                            <span
                              className={`px-2 py-0.5 text-[10px] font-mono uppercase font-semibold border ${
                                p.linked_owner_property.shared
                                  ? "bg-accepted-bg text-accepted border-accepted-border"
                                  : "bg-page text-ink-500 border-ink-200"
                              }`}
                            >
                              {p.linked_owner_property.shared ? "REPORT SHARED" : "NOT SHARED"}
                            </span>
                          )}
                          <Link
                            href={`/properties/${p.id}`}
                            className="text-xs font-mono text-accent hover:underline font-semibold"
                          >
                            Edit flat →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
