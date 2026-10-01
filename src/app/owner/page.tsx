"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { createOwnerPropertySchema, type CreateOwnerPropertyInput } from "@/lib/validation";
import type { OwnerProperty } from "@/types/database";

export default function OwnerDashboardPage() {
  const [properties, setProperties] = useState<OwnerProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Copy feedback state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchProperties = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOwnerProperties();
      setProperties(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load owner property register. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const payload: CreateOwnerPropertyInput = {
      name: name.trim(),
      address: address.trim() || null,
      city: city.trim() || null,
    };

    const validation = createOwnerPropertySchema.safeParse(payload);
    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors;
      const mapped: Record<string, string> = {};
      Object.entries(fieldErrors).forEach(([k, v]) => {
        if (v?.[0]) mapped[k] = v[0];
      });
      setFormErrors(mapped);
      return;
    }

    setSubmitting(true);
    try {
      await api.createOwnerProperty(payload);
      setName("");
      setAddress("");
      setCity("");
      setShowAddModal(false);
      await fetchProperties();
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        const mapped: Record<string, string> = {};
        Object.entries(err.details).forEach(([k, v]) => {
          if (v?.[0]) mapped[k] = v[0];
        });
        setFormErrors(mapped);
      } else if (err instanceof ApiError) {
        setFormErrors({ general: err.message });
      } else {
        setFormErrors({ general: "Failed to register property. Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const totalLinkedTenants = properties.reduce(
    (acc, p) => acc + (p.linked_tenants_count || 0),
    0
  );

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-ink-200 pb-5 mb-8 gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
            OWNER REGISTER · 01
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-900 mt-1">
            Owner Properties
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-ink-600 font-mono">
            <span>
              {String(properties.length).padStart(2, "0")}{" "}
              {properties.length === 1 ? "PROPERTY" : "PROPERTIES"}
            </span>
            <span>·</span>
            <span>
              {String(totalLinkedTenants).padStart(2, "0")}{" "}
              {totalLinkedTenants === 1 ? "LINKED TENANT" : "LINKED TENANTS"}
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors self-start sm:self-auto btn-motion lit-dark"
        >
          + Add property
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-damage-bg border border-damage-border text-xs text-damage flex items-center justify-between font-mono">
          <span>[!] {error}</span>
          <button
            onClick={fetchProperties}
            className="underline font-semibold hover:text-damage ml-4 btn-motion"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="border border-ink-200 bg-surface divide-y divide-ink-100">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 sm:p-5 animate-pulse flex items-center justify-between">
              <div className="space-y-2 w-1/3">
                <div className="h-4 bg-page w-3/4"></div>
                <div className="h-3 bg-page w-1/2"></div>
              </div>
              <div className="h-4 bg-page w-1/4"></div>
              <div className="h-6 bg-page w-20"></div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && properties.length === 0 && (
        <div className="border border-ink-200 bg-surface p-10 sm:p-16 text-center max-w-xl mx-auto my-8">
          <div className="w-8 h-8 border border-ink-200 bg-page mx-auto flex items-center justify-center text-ink-500 font-mono text-xs mb-3">
            00
          </div>
          <div className="text-[10px] font-mono uppercase text-ink-500 mb-1">
            REGISTER EMPTY
          </div>
          <h2 className="text-lg font-bold text-ink-900 mb-2">
            No Properties Registered Yet
          </h2>
          <p className="text-xs text-ink-600 leading-relaxed mb-6 max-w-md mx-auto">
            Register your rental property to generate a secure, 8-character join code. Share the code with your tenant so they can link their inspection records to your property.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors btn-motion lit-dark"
          >
            + Add property
          </button>
        </div>
      )}

      {/* Structured Register Table */}
      {!loading && !error && properties.length > 0 && (
        <div className="border border-ink-200 bg-surface overflow-x-auto mb-8">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-ink-200 bg-page text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                <th className="py-3 px-4 font-semibold">PROPERTY & ADDRESS</th>
                <th className="py-3 px-4 font-semibold">CITY</th>
                <th className="py-3 px-4 font-semibold">JOIN CODE</th>
                <th className="py-3 px-4 font-semibold">LINKED TENANTS</th>
                <th className="py-3 px-4 font-semibold text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 font-sans">
              {properties.map((prop) => (
                <tr
                  key={prop.id}
                  className="hover:bg-page/60 transition-colors group interactive-row lit"
                >
                  <td className="py-4 px-4 font-medium text-ink-900 align-top">
                    <Link
                      href={`/owner/properties/${prop.id}`}
                      className="font-semibold text-ink-900 hover:text-accent flex flex-col"
                    >
                      <span className="text-sm font-bold text-ink-900 group-hover:text-accent transition-colors">
                        {prop.name}
                      </span>
                      {prop.address ? (
                        <span className="text-[11px] text-ink-500 font-normal mt-0.5">
                          {prop.address}
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-400 font-mono mt-0.5">
                          No address specified
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="py-4 px-4 font-mono text-[11px] text-ink-600 whitespace-nowrap align-top">
                    {prop.city || "—"}
                  </td>
                  <td className="py-4 px-4 font-mono text-[12px] whitespace-nowrap align-top">
                    <div className="inline-flex items-center gap-2 bg-page border border-ink-200 px-2.5 py-1">
                      <span className="font-bold tracking-wider text-ink-900">
                        {prop.join_code}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(prop.join_code)}
                        className="text-[10px] uppercase font-semibold text-accent hover:text-accent-hover tracking-wider border-l border-ink-200 pl-2 transition-colors"
                        title="Copy join code"
                      >
                        {copiedCode === prop.join_code ? "COPIED" : "COPY"}
                      </button>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono text-[11px] whitespace-nowrap align-top">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-mono uppercase font-semibold border ${
                        (prop.linked_tenants_count || 0) > 0
                          ? "bg-accent-tint text-accent border-accent-border"
                          : "bg-page text-ink-500 border-ink-200"
                      }`}
                    >
                      {prop.linked_tenants_count || 0}{" "}
                      {(prop.linked_tenants_count || 0) === 1 ? "TENANT" : "TENANTS"}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right whitespace-nowrap align-top">
                    <Link
                      href={`/owner/properties/${prop.id}`}
                      className="inline-flex items-center text-xs font-mono text-accent hover:underline font-semibold"
                    >
                      View Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Explanatory callout */}
      <div className="border border-ink-200 bg-page p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[10px] font-mono uppercase text-ink-500">
            JOIN CODE PROTOCOL
          </div>
          <p className="text-xs text-ink-700 max-w-2xl leading-relaxed">
            Give the 8-character join code to your tenant when handing over the keys. They link the code in their Intact record to enable verified inspection report sharing.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-surface hover:bg-white text-ink-900 border border-ink-300 hover:border-ink-500 text-xs font-semibold uppercase tracking-wider font-mono transition-colors whitespace-nowrap btn-motion lit"
        >
          + Add property
        </button>
      </div>

      {/* Add Property Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-ink-200 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-ink-200 pb-3 mb-5 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase text-ink-500">
                  NEW REGISTER ENTRY · OWNER
                </div>
                <h2 className="text-base font-bold text-ink-900">
                  Register Owner Property
                </h2>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-ink-500 hover:text-ink-900 font-mono text-sm"
              >
                [✕]
              </button>
            </div>

            {formErrors.general && (
              <div className="mb-4 p-3 bg-damage-bg border border-damage-border text-xs text-damage font-mono">
                [!] {formErrors.general}
              </div>
            )}

            <form onSubmit={handleCreateProperty} className="space-y-4 text-xs">
              <div>
                <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                  Property Name / Unit <span className="text-damage">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Flat 402, Oakwood Towers"
                  className={`w-full px-3 py-2 border bg-page focus:bg-surface focus:outline-none ${
                    formErrors.name ? "border-damage" : "border-ink-200 focus:border-accent"
                  }`}
                />
                {formErrors.name && (
                  <p className="text-damage mt-1 font-mono text-[11px]">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                  Street Address (Optional)
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 14th Main Road, Sector 3, HSR Layout"
                  className="w-full px-3 py-2 border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent"
                />
                {formErrors.address && (
                  <p className="text-damage mt-1 font-mono text-[11px]">{formErrors.address}</p>
                )}
              </div>

              <div>
                <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                  City (Optional)
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Bengaluru"
                  className="w-full px-3 py-2 border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent"
                />
                {formErrors.city && (
                  <p className="text-damage mt-1 font-mono text-[11px]">{formErrors.city}</p>
                )}
              </div>

              <div className="p-3 bg-page border border-ink-200 text-ink-600 font-mono text-[11px] space-y-1">
                <div className="font-bold text-ink-800">AUTOMATIC JOIN CODE</div>
                <div>
                  An 8-character unambiguous code will be generated automatically for this property.
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-ink-200 hover:border-ink-400 bg-surface text-ink-700 text-xs font-semibold uppercase tracking-wider transition-colors btn-motion lit"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 btn-motion lit-dark"
                >
                  {submitting ? "Registering..." : "Register Property"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
