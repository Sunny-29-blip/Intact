"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { createPropertySchema, type CreatePropertyInput } from "@/lib/validation";
import type { PropertyListItem } from "@/types/database";

export default function PropertiesPage() {
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [tenancyStart, setTenancyStart] = useState("");
  const [tenancyEnd, setTenancyEnd] = useState("");
  const [leaseNotes, setLeaseNotes] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const fetchProperties = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getProperties();
      setProperties(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load properties register. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const payload: CreatePropertyInput = {
      name: name.trim(),
      address: address.trim() || null,
      tenancy_start: tenancyStart,
      tenancy_end: tenancyEnd || null,
      lease_notes: leaseNotes.trim() || null,
    };

    const validation = createPropertySchema.safeParse(payload);
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
      await api.createProperty(payload);
      setName("");
      setAddress("");
      setTenancyStart("");
      setTenancyEnd("");
      setLeaseNotes("");
      setShowCreateModal(false);
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
        setFormErrors({ general: "Failed to create property record. Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getTenancyStatus = (prop: PropertyListItem) => {
    if (prop.move_in_count === 0) {
      return { label: "No Photos", style: "bg-page text-ink-500 border-ink-200" };
    }
    if (prop.move_out_count === 0) {
      return { label: "Move-In Recorded", style: "bg-accent-tint text-accent border-accent-border" };
    }
    if (prop.move_out_count < prop.move_in_count) {
      return { label: "Partially Paired", style: "bg-wear-bg text-wear border-wear-border" };
    }
    return { label: "Fully Paired", style: "bg-accepted-bg text-accepted border-accepted-border" };
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-ink-200 pb-5 mb-6 gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
            INSPECTION REGISTER
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 mt-1">
            Properties
          </h1>
          <p className="text-xs text-ink-600 mt-1">
            One record per tenancy. Open a property to add photos or compare them.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors self-start sm:self-auto btn-motion lit-dark"
        >
          + Add property
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-damage-bg border border-damage-border text-xs text-damage flex items-center justify-between">
          <span>{error}</span>
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
            <div key={i} className="p-4 animate-pulse flex items-center justify-between">
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
        <div className="border border-ink-200 bg-surface p-10 sm:p-16 text-center max-w-lg mx-auto my-8">
          <div className="w-8 h-8 border border-ink-200 bg-page mx-auto flex items-center justify-center text-ink-500 font-mono text-xs mb-3">
            00
          </div>
          <h2 className="text-base font-bold text-ink-900 mb-1">
            No Properties Recorded
          </h2>
          <p className="text-xs text-ink-600 leading-relaxed mb-6">
            Begin by creating your rental property record. You will then be able to
            catalog move-in photos by area and pair move-out photos at departure.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors btn-motion lit-dark"
          >
            + Add property
          </button>
        </div>
      )}

      {/* Structured Register Table */}
      {!loading && !error && properties.length > 0 && (
        <div className="border border-ink-200 bg-surface overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-ink-200 bg-page text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                <th className="py-3 px-4 font-semibold">PROPERTY</th>
                <th className="py-3 px-4 font-semibold">TENANCY</th>
                <th className="py-3 px-4 font-semibold">MOVE-IN</th>
                <th className="py-3 px-4 font-semibold">MOVE-OUT</th>
                <th className="py-3 px-4 font-semibold">STATUS</th>
                <th className="py-3 px-4 font-semibold text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {properties.map((prop) => {
                const status = getTenancyStatus(prop);
                return (
                  <tr
                    key={prop.id}
                    className="hover:bg-page/60 transition-colors group interactive-row lit"
                  >
                    <td className="py-3.5 px-4 font-medium text-ink-900">
                      <Link
                        href={`/properties/${prop.id}`}
                        className="font-semibold text-ink-900 hover:text-accent flex flex-col"
                      >
                        <span>{prop.name}</span>
                        {prop.address && (
                          <span className="text-[11px] text-ink-500 font-normal mt-0.5">
                            {prop.address}
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-ink-600 whitespace-nowrap">
                      {prop.tenancy_start}
                      {prop.tenancy_end ? ` → ${prop.tenancy_end}` : " (Ongoing)"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-ink-700 whitespace-nowrap">
                      {prop.move_in_count > 0 ? (
                        <span>
                          <strong>{prop.move_in_count}</strong> {prop.move_in_count === 1 ? "area" : "areas"}
                        </span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-ink-700 whitespace-nowrap">
                      {prop.move_in_count > 0 ? (
                        <span>
                          {prop.move_out_count} of {prop.move_in_count} areas
                        </span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-mono uppercase font-semibold border ${status.style}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Link
                        href={`/properties/${prop.id}`}
                        className="inline-flex items-center text-xs font-mono text-accent hover:underline font-semibold"
                      >
                        Open Record →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Property Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-ink-200 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-ink-200 pb-3 mb-5 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase text-ink-500">
                  NEW REGISTER ENTRY
                </div>
                <h2 className="text-base font-bold text-ink-900">
                  Add Rental Property
                </h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-ink-500 hover:text-ink-900 font-mono text-sm"
              >
                [✕]
              </button>
            </div>

            {formErrors.general && (
              <div className="mb-4 p-3 bg-damage-bg border border-damage-border text-xs text-damage">
                {formErrors.general}
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
                  placeholder="e.g. Greenview Apts — Flat 302"
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
                  Address / City
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 14th Main, HSR Layout, Bengaluru"
                  className="w-full px-3 py-2 border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent"
                />
                {formErrors.address && (
                  <p className="text-damage mt-1 font-mono text-[11px]">{formErrors.address}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                    Tenancy Start <span className="text-damage">*</span>
                  </label>
                  <input
                    type="date"
                    value={tenancyStart}
                    onChange={(e) => setTenancyStart(e.target.value)}
                    className={`w-full px-3 py-2 border bg-page focus:bg-surface focus:outline-none font-mono ${
                      formErrors.tenancy_start
                        ? "border-damage"
                        : "border-ink-200 focus:border-accent"
                    }`}
                  />
                  {formErrors.tenancy_start && (
                    <p className="text-damage mt-1 font-mono text-[11px]">{formErrors.tenancy_start}</p>
                  )}
                </div>

                <div>
                  <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                    Tenancy End (Optional)
                  </label>
                  <input
                    type="date"
                    value={tenancyEnd}
                    onChange={(e) => setTenancyEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent font-mono"
                  />
                  {formErrors.tenancy_end && (
                    <p className="text-damage mt-1 font-mono text-[11px]">{formErrors.tenancy_end}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                  Lease Notes / Deposit Terms (Optional)
                </label>
                <textarea
                  value={leaseNotes}
                  onChange={(e) => setLeaseNotes(e.target.value)}
                  rows={3}
                  placeholder="Deposit amount, specific agreement terms regarding wall repainting, fixture repairs, or cleaning..."
                  className="w-full px-3 py-2 border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
                  {submitting ? "Recording..." : "Create Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
