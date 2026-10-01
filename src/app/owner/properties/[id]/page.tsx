"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { updateOwnerPropertySchema, type UpdateOwnerPropertyInput } from "@/lib/validation";
import type { OwnerPropertyDetail } from "@/types/database";

export default function OwnerPropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const propertyId = resolvedParams.id;
  const router = useRouter();

  const [property, setProperty] = useState<OwnerPropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Copy feedback
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchProperty = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOwnerProperty(propertyId);
      setProperty(data);
      setEditName(data.name);
      setEditAddress(data.address || "");
      setEditCity(data.city || "");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load property details. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperty();
  }, [propertyId]);

  const handleCopyCode = async () => {
    if (!property) return;
    try {
      await navigator.clipboard.writeText(property.join_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditErrors({});

    const payload: UpdateOwnerPropertyInput = {
      name: editName.trim(),
      address: editAddress.trim() || null,
      city: editCity.trim() || null,
    };

    const validation = updateOwnerPropertySchema.safeParse(payload);
    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors;
      const mapped: Record<string, string> = {};
      Object.entries(fieldErrors).forEach(([k, v]) => {
        if (v?.[0]) mapped[k] = v[0];
      });
      setEditErrors(mapped);
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateOwnerProperty(propertyId, payload);
      setProperty((prev) => (prev ? { ...prev, ...updated } : null));
      setShowEditModal(false);
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        const mapped: Record<string, string> = {};
        Object.entries(err.details).forEach(([k, v]) => {
          if (v?.[0]) mapped[k] = v[0];
        });
        setEditErrors(mapped);
      } else if (err instanceof ApiError) {
        setEditErrors({ general: err.message });
      } else {
        setEditErrors({ general: "Failed to update property. Please try again." });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteOwnerProperty(propertyId);
      router.push("/owner");
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert("Failed to delete property. Please try again.");
      }
      setDeleting(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Back button & Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/owner"
          className="inline-flex items-center text-xs font-mono text-ink-600 hover:text-ink-900 transition-colors"
        >
          ← Back to Owner Register
        </Link>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-6">
          <div className="border border-ink-200 bg-surface p-6 animate-pulse space-y-4">
            <div className="h-4 bg-page w-1/4"></div>
            <div className="h-8 bg-page w-1/2"></div>
            <div className="h-4 bg-page w-1/3"></div>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-6 bg-damage-bg border border-damage-border text-xs text-damage font-mono">
          <div className="font-bold mb-2">[!] Error Loading Property</div>
          <div>{error}</div>
          <button
            onClick={fetchProperty}
            className="mt-4 underline font-semibold hover:text-damage"
          >
            Retry
          </button>
        </div>
      )}

      {/* Property Details */}
      {!loading && !error && property && (
        <div className="space-y-8">
          {/* Header Card */}
          <div className="bg-surface border border-ink-200 p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-ink-200">
              <div>
                <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                  OWNER PROPERTY RECORD · {property.id.slice(0, 8).toUpperCase()}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-900 mt-1">
                  {property.name}
                </h1>
                <div className="mt-2 text-xs text-ink-600 space-y-0.5">
                  {property.address && <p>{property.address}</p>}
                  {property.city && (
                    <p className="font-mono text-[11px] text-ink-500">{property.city}</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 self-start">
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="px-3 py-2 border border-ink-200 hover:border-ink-400 bg-page text-ink-800 text-xs font-semibold uppercase tracking-wider font-mono transition-colors btn-motion lit"
                >
                  Edit Property
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="px-3 py-2 border border-damage-border hover:bg-damage-bg text-damage text-xs font-semibold uppercase tracking-wider font-mono transition-colors btn-motion"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Join Code Banner */}
            <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="sm:col-span-2 bg-page border border-ink-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                    TENANT JOIN CODE
                  </div>
                  <div className="text-xs text-ink-600 mt-0.5">
                    Share this code with your tenant to link their inspection records.
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-surface border border-ink-200 px-3 py-1.5 font-mono">
                  <span className="text-base font-bold tracking-widest text-ink-900">
                    {property.join_code}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="text-[11px] uppercase font-semibold text-accent hover:text-accent-hover tracking-wider border-l border-ink-200 pl-2.5 transition-colors"
                  >
                    {copiedCode ? "COPIED" : "COPY"}
                  </button>
                </div>
              </div>

              <div className="bg-page border border-ink-200 p-4">
                <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                  LINKED TENANTS
                </div>
                <div className="text-2xl font-bold font-mono text-ink-900 mt-1">
                  {property.linked_tenants?.length || 0}
                </div>
                <div className="text-[10px] font-mono text-ink-500 mt-0.5">
                  {(property.linked_tenants || []).filter((t) => t.shared).length} report(s) shared
                </div>
              </div>
            </div>
          </div>

          {/* Linked Tenants Section */}
          <div className="bg-surface border border-ink-200 p-6 sm:p-8">
            <div className="border-b border-ink-200 pb-4 mb-6">
              <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                SECTION 02 · LINKED TENANTS
              </div>
              <h2 className="text-xl font-bold text-ink-900 mt-1">
                Tenancy Records
              </h2>
              <p className="text-xs text-ink-600 mt-1">
                Tenants who link using this property's join code. Property condition and photos remain private to the tenant unless they explicitly share their read-only inspection report.
              </p>
            </div>

            {(!property.linked_tenants || property.linked_tenants.length === 0) ? (
              <div className="border border-dashed border-ink-200 p-8 text-center bg-page">
                <div className="text-xs font-mono text-ink-500 uppercase tracking-wider mb-1">
                  NO TENANTS LINKED YET
                </div>
                <p className="text-xs text-ink-600 max-w-md mx-auto">
                  Provide join code <strong className="font-mono text-ink-900">{property.join_code}</strong> to your tenant. Once they link it in their Intact record, their status will appear here.
                </p>
              </div>
            ) : (
              <div className="border border-ink-200 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-ink-200 bg-page text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                      <th className="py-3 px-4 font-semibold">TENANT</th>
                      <th className="py-3 px-4 font-semibold">LINKED ON</th>
                      <th className="py-3 px-4 font-semibold">REPORT SHARING</th>
                      <th className="py-3 px-4 font-semibold text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 font-sans">
                    {property.linked_tenants.map((tenant) => (
                      <tr key={tenant.link_id} className="hover:bg-page/60 transition-colors">
                        <td className="py-4 px-4 font-medium text-ink-900">
                          <span className="font-semibold">
                            {tenant.display_name || "Tenant"}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-mono text-[11px] text-ink-600">
                          {new Date(tenant.linked_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-4 px-4">
                          {tenant.shared ? (
                            <span className="inline-block px-2 py-0.5 text-[10px] font-mono uppercase font-semibold bg-accepted-bg text-accepted border border-accepted-border">
                              REPORT SHARED
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 text-[10px] font-mono uppercase font-semibold bg-page text-ink-500 border border-ink-200">
                              NOT SHARED BY TENANT
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {tenant.shared && tenant.report_token ? (
                            <Link
                              href={`/report/${tenant.report_token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-xs font-mono text-accent hover:underline font-semibold"
                            >
                              Open Report ↗
                            </Link>
                          ) : (
                            <span className="text-ink-400 font-mono text-[11px]">
                              Awaiting share
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-ink-200 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-ink-200 pb-3 mb-5 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase text-ink-500">
                  EDIT PROPERTY RECORD
                </div>
                <h2 className="text-base font-bold text-ink-900">
                  Update Property Details
                </h2>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-ink-500 hover:text-ink-900 font-mono text-sm"
              >
                [✕]
              </button>
            </div>

            {editErrors.general && (
              <div className="mb-4 p-3 bg-damage-bg border border-damage-border text-xs text-damage font-mono">
                [!] {editErrors.general}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4 text-xs">
              <div>
                <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                  Property Name / Unit <span className="text-damage">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`w-full px-3 py-2 border bg-page focus:bg-surface focus:outline-none ${
                    editErrors.name ? "border-damage" : "border-ink-200 focus:border-accent"
                  }`}
                />
                {editErrors.name && (
                  <p className="text-damage mt-1 font-mono text-[11px]">{editErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent"
                />
                {editErrors.address && (
                  <p className="text-damage mt-1 font-mono text-[11px]">{editErrors.address}</p>
                )}
              </div>

              <div>
                <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="w-full px-3 py-2 border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent"
                />
                {editErrors.city && (
                  <p className="text-damage mt-1 font-mono text-[11px]">{editErrors.city}</p>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                  className="px-4 py-2 border border-ink-200 hover:border-ink-400 bg-surface text-ink-700 text-xs font-semibold uppercase tracking-wider transition-colors btn-motion lit"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 btn-motion lit-dark"
                >
                  {saving ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-damage-border max-w-md w-full p-6">
            <div className="border-b border-ink-200 pb-3 mb-4">
              <div className="text-[10px] font-mono uppercase text-damage font-bold tracking-wider">
                CONFIRM DELETION
              </div>
              <h2 className="text-base font-bold text-ink-900 mt-1">
                Delete Owner Property?
              </h2>
            </div>
            <p className="text-xs text-ink-600 mb-6 leading-relaxed">
              Are you sure you want to delete <strong className="text-ink-900">{property?.name}</strong>? All linked tenancy links for this owner property will be removed. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 border border-ink-200 hover:border-ink-400 bg-surface text-ink-700 text-xs font-semibold uppercase tracking-wider transition-colors btn-motion lit"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-damage hover:bg-damage/90 text-white text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 btn-motion"
              >
                {deleting ? "Deleting..." : "Delete Property"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
