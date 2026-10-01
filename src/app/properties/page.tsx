"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { api, ApiError } from "@/lib/api";
import { uploadAndRegisterDocument } from "@/lib/client-document";
import { createPropertySchema } from "@/lib/validation";
import type { PropertyListItem } from "@/types/database";

const ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export default function PropertiesPage() {
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState("");

  // Form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tenantName, setTenantName] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [tenancyStart, setTenancyStart] = useState("");
  const [tenancyEnd, setTenancyEnd] = useState("");
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProperties = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, { data: authData }, prof] = await Promise.all([
        api.getProperties(),
        supabase.auth.getUser(),
        api.getProfile().catch(() => null),
      ]);

      setProperties(data);
      if (authData.user) {
        setUserId(authData.user.id);
      }
      if (prof?.display_name) {
        setUserDisplayName(prof.display_name);
        if (!tenantName) setTenantName(prof.display_name);
      }
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

  const openCreateModal = () => {
    setFormErrors({});
    setUploadStatus(null);
    setCreatedPropertyId(null);
    setContractFile(null);
    setName("");
    setAddress("");
    setTenancyStart("");
    setTenancyEnd("");
    setTenantName(userDisplayName || "");
    setShowCreateModal(true);
  };

  const handleContractSelection = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!ALLOWED_MIMES.includes(file.type)) {
      setFormErrors((prev) => ({
        ...prev,
        contract: `Invalid file type. Only PDF, JPEG, PNG, and WebP are allowed.`,
      }));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFormErrors((prev) => ({
        ...prev,
        contract: `File exceeds 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
      }));
      return;
    }

    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.contract;
      return next;
    });
    setContractFile(file);
  };

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormErrors({});
    setUploadStatus(null);

    const payload = {
      tenant_name: tenantName.trim(),
      name: name.trim(),
      address: address.trim(),
      tenancy_start: tenancyStart,
      tenancy_end: tenancyEnd,
    };

    const validation = createPropertySchema.safeParse(payload);
    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors;
      const mapped: Record<string, string> = {};
      Object.entries(fieldErrors).forEach(([k, v]) => {
        if (v?.[0]) mapped[k] = v[0];
      });
      if (!contractFile) {
        mapped.contract = "Tenancy contract document is required.";
      }
      setFormErrors(mapped);
      return;
    }

    if (!contractFile) {
      setFormErrors({ contract: "Tenancy contract document is required." });
      return;
    }

    setSubmitting(true);
    let targetPropertyId = createdPropertyId;

    try {
      // 1. Create property record if not created yet
      if (!targetPropertyId) {
        setUploadStatus("Opening inspection record...");
        const createdProp = await api.createProperty(payload);
        targetPropertyId = createdProp.id;
        setCreatedPropertyId(createdProp.id);
      }

      if (!userId) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) setUserId(userData.user.id);
      }
      const activeUserId = userId || (await supabase.auth.getUser()).data.user?.id;

      if (!activeUserId || !targetPropertyId) {
        throw new Error("Unable to identify authenticated user or property session.");
      }

      // 2. Upload and register the contract document
      setUploadStatus("Uploading tenancy contract document...");
      await uploadAndRegisterDocument({
        userId: activeUserId,
        kind: "tenancy_contract",
        parentId: targetPropertyId,
        file: contractFile,
        onProgress: (status) => setUploadStatus(status),
      });

      // All succeeded
      setShowCreateModal(false);
      await fetchProperties();
    } catch (err) {
      console.error("Property creation/upload error:", err);
      if (err instanceof ApiError && err.details) {
        const mapped: Record<string, string> = {};
        Object.entries(err.details).forEach(([k, v]) => {
          if (v?.[0]) mapped[k] = v[0];
        });
        setFormErrors(mapped);
      } else if (err instanceof ApiError) {
        setFormErrors({ general: err.message });
      } else {
        setFormErrors({
          general: err instanceof Error
            ? `${err.message} The property record was created. Click Retry Upload to attach your contract.`
            : "Failed to complete setup. Please click Retry.",
        });
      }
      await fetchProperties();
    } finally {
      setSubmitting(false);
      setUploadStatus(null);
    }
  };

  const isFormValid =
    tenantName.trim().length > 0 &&
    name.trim().length > 0 &&
    address.trim().length > 0 &&
    tenancyStart.length > 0 &&
    tenancyEnd.length > 0 &&
    tenancyEnd > tenancyStart &&
    contractFile !== null;

  const getTenancyStatus = (prop: PropertyListItem) => {
    if (prop.move_in_count === 0) {
      return { label: "NO PHOTOS", style: "bg-page text-ink-500 border-ink-200" };
    }
    if (prop.move_out_count === 0) {
      return { label: "MOVE-IN RECORDED", style: "bg-accent-tint text-accent border-accent-border" };
    }
    if (prop.move_out_count < prop.move_in_count) {
      return { label: "IN REVIEW", style: "bg-wear-bg text-wear border-wear-border" };
    }
    return { label: "REPORT READY", style: "bg-accepted-bg text-accepted border-accepted-border" };
  };

  const getPropertyRef = (id: string) => {
    const clean = id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
    return `PR-${clean || "1001"}`;
  };

  const inReviewCount = properties.filter((p) => p.move_out_count > 0 && p.move_out_count < p.move_in_count).length;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header with section numbering */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-ink-200 pb-5 mb-8 gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
            SECTION 01 · REGISTER
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-900 mt-1">
            Inspection Register
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-ink-600 font-mono">
            <span>
              {String(properties.length).padStart(2, "0")}{" "}
              {properties.length === 1 ? "PROPERTY" : "PROPERTIES"}
            </span>
            <span>·</span>
            <span>{String(inReviewCount).padStart(2, "0")} IN REVIEW</span>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors self-start sm:self-auto btn-motion lit-dark min-h-[48px] sm:min-h-0"
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
            No Properties Recorded Yet
          </h2>
          <p className="text-xs text-ink-600 leading-relaxed mb-6 max-w-md mx-auto">
            Open an inspection record with your tenancy contract before unpacking. You will catalog baseline move-in photos by area and pair departure photos when moving out.
          </p>
          <button
            onClick={openCreateModal}
            className="px-5 py-3 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors btn-motion lit-dark min-h-[48px] sm:min-h-0"
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
                <th className="py-3 px-4 font-semibold">REF</th>
                <th className="py-3 px-4 font-semibold">PROPERTY & LOCATION</th>
                <th className="py-3 px-4 font-semibold">CONTRACT PERIOD</th>
                <th className="py-3 px-4 font-semibold">CONTRACT DOC</th>
                <th className="py-3 px-4 font-semibold">PROGRESS</th>
                <th className="py-3 px-4 font-semibold">STATUS</th>
                <th className="py-3 px-4 font-semibold text-right">RECORD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 font-sans">
              {properties.map((prop) => {
                const status = getTenancyStatus(prop);
                const refCode = getPropertyRef(prop.id);
                return (
                  <tr
                    key={prop.id}
                    className="hover:bg-page/60 transition-colors group interactive-row lit"
                  >
                    <td className="py-4 px-4 font-mono text-[11px] text-ink-500 font-bold whitespace-nowrap align-top">
                      {refCode}
                    </td>
                    <td className="py-4 px-4 font-medium text-ink-900 align-top">
                      <Link
                        href={`/properties/${prop.id}`}
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
                      <div>{prop.tenancy_start}</div>
                      <div className="text-ink-400 text-[10px]">
                        {prop.tenancy_end ? `valid until ${prop.tenancy_end}` : "(Ongoing)"}
                      </div>
                    </td>
                    <td className="py-4 px-4 font-mono text-[11px] whitespace-nowrap align-top">
                      {prop.contract ? (
                        <span className="inline-block px-2 py-0.5 text-[10px] font-mono uppercase font-semibold bg-page text-ink-700 border border-ink-200 truncate max-w-[120px]" title={prop.contract.original_name}>
                          {prop.contract.original_name}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-[10px] font-mono uppercase font-semibold bg-wear-bg text-wear border border-wear-border">
                          CONTRACT MISSING
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 font-mono text-[11px] text-ink-700 whitespace-nowrap align-top">
                      <div>
                        <span className="text-ink-500">Move-in:</span>{" "}
                        <strong className="text-ink-900">{prop.move_in_count}</strong> areas
                      </div>
                      <div className="text-[10px] text-ink-500 mt-0.5">
                        Move-out: {prop.move_out_count} / {prop.move_in_count || 0}
                      </div>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap align-top">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-mono uppercase font-semibold border ${status.style}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right whitespace-nowrap align-top">
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

      {/* Bottom Callout */}
      <div className="border border-ink-200 bg-page p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[10px] font-mono uppercase text-ink-500">
            RECORD TIMING PRINCIPLE
          </div>
          <p className="text-xs text-ink-700 max-w-2xl leading-relaxed">
            Add your tenancy before unpacking or decorating. A record is most useful when opened on handover day — before anything is unpacked, moved or cleaned.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-surface hover:bg-white text-ink-900 border border-ink-300 hover:border-ink-500 text-xs font-semibold uppercase tracking-wider font-mono transition-colors whitespace-nowrap btn-motion lit min-h-[48px] sm:min-h-0"
        >
          + Add property
        </button>
      </div>

      {/* Add Property Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-ink-200 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-ink-200 pb-3 mb-5 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase text-ink-500">
                  NEW REGISTER ENTRY · TENANT
                </div>
                <h2 className="text-base font-bold text-ink-900">
                  Open Property Record
                </h2>
              </div>
              <button
                onClick={() => {
                  if (!submitting) setShowCreateModal(false);
                }}
                disabled={submitting}
                className="text-ink-500 hover:text-ink-900 font-mono text-sm disabled:opacity-50"
              >
                [✕]
              </button>
            </div>

            {formErrors.general && (
              <div className="mb-4 p-3 bg-damage-bg border border-damage-border text-xs text-damage font-mono">
                [!] {formErrors.general}
              </div>
            )}

            {uploadStatus && (
              <div className="mb-4 p-3 bg-accent-tint border border-accent-border text-accent font-mono text-xs animate-pulse">
                {uploadStatus}
              </div>
            )}

            <form onSubmit={handleCreateProperty} className="space-y-4 text-xs">
              <div>
                <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                  Your Name <span className="text-damage">*</span>
                </label>
                <input
                  type="text"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  disabled={submitting || !!createdPropertyId}
                  className={`w-full px-3 py-2 border bg-page focus:bg-surface focus:outline-none ${
                    formErrors.tenant_name ? "border-damage" : "border-ink-200 focus:border-accent"
                  }`}
                />
                {formErrors.tenant_name && (
                  <p className="text-damage mt-1 font-mono text-[11px]">{formErrors.tenant_name}</p>
                )}
              </div>

              <div>
                <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                  Flat or House Name <span className="text-damage">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Flat 4, Carlow House"
                  disabled={submitting || !!createdPropertyId}
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
                  Address <span className="text-damage">*</span>
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 12 Elm Grove, Indiranagar, Bengaluru"
                  disabled={submitting || !!createdPropertyId}
                  className={`w-full px-3 py-2 border bg-page focus:bg-surface focus:outline-none ${
                    formErrors.address ? "border-damage" : "border-ink-200 focus:border-accent"
                  }`}
                />
                {formErrors.address && (
                  <p className="text-damage mt-1 font-mono text-[11px]">{formErrors.address}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                    Contract Start Date <span className="text-damage">*</span>
                  </label>
                  <input
                    type="date"
                    value={tenancyStart}
                    onChange={(e) => setTenancyStart(e.target.value)}
                    disabled={submitting || !!createdPropertyId}
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
                    Contract Valid Until <span className="text-damage">*</span>
                  </label>
                  <input
                    type="date"
                    value={tenancyEnd}
                    onChange={(e) => setTenancyEnd(e.target.value)}
                    disabled={submitting || !!createdPropertyId}
                    className={`w-full px-3 py-2 border bg-page focus:bg-surface focus:outline-none font-mono ${
                      formErrors.tenancy_end
                        ? "border-damage"
                        : "border-ink-200 focus:border-accent"
                    }`}
                  />
                  {formErrors.tenancy_end && (
                    <p className="text-damage mt-1 font-mono text-[11px]">{formErrors.tenancy_end}</p>
                  )}
                </div>
              </div>

              {/* Contract document upload */}
              <div>
                <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                  Contract with the Owner <span className="text-damage">*</span>
                </label>

                {/* Dropzone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (!submitting) handleContractSelection(e.dataTransfer.files);
                  }}
                  onClick={() => {
                    if (!submitting) fileInputRef.current?.click();
                  }}
                  className={`border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? "border-accent bg-accent-tint/30"
                      : formErrors.contract
                      ? "border-damage bg-damage-bg/20"
                      : "border-ink-200 hover:border-ink-400 bg-page"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => handleContractSelection(e.target.files)}
                    disabled={submitting}
                    className="hidden"
                  />
                  <div className="font-mono text-xs text-ink-800 font-semibold">
                    {contractFile ? contractFile.name : "Click or drag & drop tenancy contract here"}
                  </div>
                  <div className="text-[10px] font-mono text-ink-500 mt-1">
                    {contractFile
                      ? `${(contractFile.size / (1024 * 1024)).toFixed(2)} MB · ${contractFile.type.split("/")[1]?.toUpperCase() || "DOCUMENT"}`
                      : "PDF, JPEG, PNG, or WebP (max 10 MB)"}
                  </div>
                </div>

                <p className="text-[10px] font-mono text-ink-500 mt-1.5">
                  Stored privately. Only you can open it. Do not upload ID numbers or bank details.
                </p>

                {formErrors.contract && (
                  <p className="text-damage mt-1 font-mono text-[11px]">{formErrors.contract}</p>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                  className="px-4 py-2.5 border border-ink-200 hover:border-ink-400 bg-surface text-ink-700 text-xs font-semibold uppercase tracking-wider transition-colors btn-motion lit min-h-[48px] sm:min-h-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !isFormValid}
                  className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 btn-motion lit-dark min-h-[48px] sm:min-h-0"
                >
                  {submitting
                    ? "Saving & Uploading..."
                    : createdPropertyId
                    ? "Retry Upload"
                    : "+ Open Property Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
