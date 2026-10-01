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
        setError("Failed to load properties. Please try again.");
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
      // Reset form
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
        setFormErrors({ general: "Failed to create property. Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-ink-200 pb-5 mb-8 gap-4">
        <div>
          <div className="text-xs font-mono uppercase text-ink-500 tracking-wider">
            Tenancy Inspection Portfolio
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 mt-1">
            Registered Properties
          </h1>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded transition-colors"
        >
          + Add Rental Property
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-damage-bg border border-damage-border rounded text-xs text-damage flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchProperties}
            className="underline font-medium hover:text-damage"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white border border-ink-200 rounded p-6 animate-pulse"
            >
              <div className="h-5 bg-paper-200 rounded w-1/3 mb-3"></div>
              <div className="h-4 bg-paper-100 rounded w-1/2 mb-4"></div>
              <div className="h-4 bg-paper-100 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && properties.length === 0 && (
        <div className="bg-white border border-ink-200 rounded p-8 sm:p-12 text-center max-w-lg mx-auto my-8">
          <div className="w-10 h-10 border border-ink-200 bg-paper-50 rounded mx-auto flex items-center justify-center text-ink-600 mb-4 font-mono text-sm">
            00
          </div>
          <h2 className="text-lg font-bold text-ink-900 mb-2">
            No Rental Properties Recorded
          </h2>
          <p className="text-xs text-ink-600 leading-relaxed mb-6">
            Begin by adding your current rental property. Once created, you will be
            able to photograph and catalog each room for move-in baseline and move-out
            verification.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded transition-colors"
          >
            Add Your First Property
          </button>
        </div>
      )}

      {/* Properties List */}
      {!loading && !error && properties.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {properties.map((prop) => (
            <Link
              key={prop.id}
              href={`/properties/${prop.id}`}
              className="block bg-white border border-ink-200 hover:border-ink-400 rounded p-5 sm:p-6 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-ink-900 hover:text-accent">
                    {prop.name}
                  </h2>
                  {prop.address && (
                    <p className="text-xs text-ink-600 mt-0.5">{prop.address}</p>
                  )}
                  <div className="flex items-center space-x-3 mt-3 text-xs font-mono text-ink-500">
                    <span>
                      Tenancy: {prop.tenancy_start}
                      {prop.tenancy_end ? ` → ${prop.tenancy_end}` : " (Ongoing)"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  <span className="px-2.5 py-1 bg-paper-100 border border-ink-200 rounded font-mono text-ink-700">
                    Move-in: <strong className="text-ink-900">{prop.move_in_count}</strong> photos
                  </span>
                  <span className="px-2.5 py-1 bg-paper-100 border border-ink-200 rounded font-mono text-ink-700">
                    Move-out: <strong className="text-ink-900">{prop.move_out_count}</strong> photos
                  </span>
                  <span className="text-accent font-semibold ml-2">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Property Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-ink-200 rounded max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-ink-100 pb-3 mb-5 flex items-center justify-between">
              <div>
                <div className="text-xs font-mono uppercase text-ink-500">
                  New Record
                </div>
                <h2 className="text-lg font-bold text-ink-900">
                  Add Rental Property
                </h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-ink-500 hover:text-ink-900 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {formErrors.general && (
              <div className="mb-4 p-3 bg-damage-bg border border-damage-border rounded text-xs text-damage">
                {formErrors.general}
              </div>
            )}

            <form onSubmit={handleCreateProperty} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-ink-700 uppercase tracking-wider mb-1">
                  Property Name / Unit <span className="text-damage">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 742 Evergreen Terrace — Apt 4B"
                  className={`w-full px-3 py-2 border rounded bg-paper-50 focus:bg-white focus:outline-none ${
                    formErrors.name ? "border-damage" : "border-ink-200 focus:border-accent"
                  }`}
                />
                {formErrors.name && (
                  <p className="text-damage mt-1">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block font-medium text-ink-700 uppercase tracking-wider mb-1">
                  Full Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, Postal Code"
                  className="w-full px-3 py-2 border border-ink-200 rounded bg-paper-50 focus:bg-white focus:outline-none focus:border-accent"
                />
                {formErrors.address && (
                  <p className="text-damage mt-1">{formErrors.address}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink-700 uppercase tracking-wider mb-1">
                    Tenancy Start Date <span className="text-damage">*</span>
                  </label>
                  <input
                    type="date"
                    value={tenancyStart}
                    onChange={(e) => setTenancyStart(e.target.value)}
                    className={`w-full px-3 py-2 border rounded bg-paper-50 focus:bg-white focus:outline-none ${
                      formErrors.tenancy_start
                        ? "border-damage"
                        : "border-ink-200 focus:border-accent"
                    }`}
                  />
                  {formErrors.tenancy_start && (
                    <p className="text-damage mt-1">{formErrors.tenancy_start}</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-ink-700 uppercase tracking-wider mb-1">
                    Tenancy End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={tenancyEnd}
                    onChange={(e) => setTenancyEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-ink-200 rounded bg-paper-50 focus:bg-white focus:outline-none focus:border-accent"
                  />
                  {formErrors.tenancy_end && (
                    <p className="text-damage mt-1">{formErrors.tenancy_end}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink-700 uppercase tracking-wider mb-1">
                  Lease Notes / Deposit Terms (Optional)
                </label>
                <textarea
                  value={leaseNotes}
                  onChange={(e) => setLeaseNotes(e.target.value)}
                  rows={3}
                  placeholder="Security deposit amount, specific clauses regarding wall mounting or carpet cleaning..."
                  className="w-full px-3 py-2 border border-ink-200 rounded bg-paper-50 focus:bg-white focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-ink-200 hover:border-ink-400 bg-white text-ink-700 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded transition-colors disabled:opacity-50"
                >
                  {submitting ? "Saving Record..." : "Create Property"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
