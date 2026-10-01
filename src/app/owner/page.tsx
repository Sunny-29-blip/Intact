"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { api, ApiError } from "@/lib/api";
import { uploadAndRegisterDocument } from "@/lib/client-document";
import { createOwnerPropertySchema } from "@/lib/validation";
import type { OwnerProperty } from "@/types/database";

const ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export default function OwnerDashboardPage() {
  const [properties, setProperties] = useState<OwnerProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState("");

  // Form modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null);
  const [failedFiles, setFailedFiles] = useState<{ file: File; error: string }[]>([]);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Copy feedback state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchProperties = async () => {
    setLoading(true);
    setError(null);
    try {
      const [props, { data: authData }, prof] = await Promise.all([
        api.getOwnerProperties(),
        supabase.auth.getUser(),
        api.getProfile().catch(() => null),
      ]);

      setProperties(props);
      if (authData.user) {
        setUserId(authData.user.id);
      }
      if (prof?.display_name) {
        setUserDisplayName(prof.display_name);
        if (!ownerName) setOwnerName(prof.display_name);
      }
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

  const handleFileSelection = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    const errors: string[] = [];

    const validFiles = newFiles.filter((f) => {
      if (!ALLOWED_MIMES.includes(f.type)) {
        errors.push(`${f.name}: Invalid file type. Only PDF, JPEG, PNG, and WebP are allowed.`);
        return false;
      }
      if (f.size > MAX_FILE_SIZE) {
        errors.push(`${f.name}: Exceeds 10 MB limit.`);
        return false;
      }
      return true;
    });

    if (errors.length > 0) {
      setFormErrors((prev) => ({ ...prev, documents: errors[0] }));
    } else {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.documents;
        return next;
      });
    }

    setSelectedFiles((prev) => {
      const combined = [...prev, ...validFiles];
      if (combined.length > 5) {
        setFormErrors((p) => ({ ...p, documents: "Maximum of 5 documents allowed per property." }));
        return combined.slice(0, 5);
      }
      return combined;
    });
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const openAddModal = () => {
    setFormErrors({});
    setUploadStatus(null);
    setCreatedPropertyId(null);
    setFailedFiles([]);
    setSelectedFiles([]);
    setName("");
    setAddress("");
    setOwnerName(userDisplayName || "");
    setShowAddModal(true);
  };

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormErrors({});
    setUploadStatus(null);

    const payload = {
      name: name.trim(),
      address: address.trim(),
      owner_name: ownerName.trim(),
    };

    const validation = createOwnerPropertySchema.safeParse(payload);
    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors;
      const mapped: Record<string, string> = {};
      Object.entries(fieldErrors).forEach(([k, v]) => {
        if (v?.[0]) mapped[k] = v[0];
      });
      if (selectedFiles.length === 0) {
        mapped.documents = "At least one document is required as property evidence.";
      }
      setFormErrors(mapped);
      return;
    }

    if (selectedFiles.length === 0) {
      setFormErrors({ documents: "At least one document is required as property evidence." });
      return;
    }

    setSubmitting(true);
    let targetPropertyId = createdPropertyId;

    try {
      // 1. Create property if not already created
      if (!targetPropertyId) {
        setUploadStatus("Creating property record...");
        const createdProp = await api.createOwnerProperty(payload);
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

      // 2. Upload and register each file
      const filesToUpload = failedFiles.length > 0 ? failedFiles.map((f) => f.file) : selectedFiles;
      const currentFailures: { file: File; error: string }[] = [];

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        setUploadStatus(`Uploading document ${i + 1} of ${filesToUpload.length}: ${file.name}...`);

        try {
          await uploadAndRegisterDocument({
            userId: activeUserId,
            kind: "property_evidence",
            parentId: targetPropertyId,
            file,
            onProgress: (status) => setUploadStatus(`[${i + 1}/${filesToUpload.length}] ${status}`),
          });
        } catch (uploadErr) {
          console.error("Document upload error:", uploadErr);
          currentFailures.push({
            file,
            error: uploadErr instanceof Error ? uploadErr.message : "Upload failed",
          });
        }
      }

      if (currentFailures.length > 0) {
        setFailedFiles(currentFailures);
        setFormErrors({
          general: `${currentFailures.length} document(s) could not be uploaded. The property has been created. Click Retry to re-upload.`,
        });
        await fetchProperties();
        return;
      }

      // All succeeded
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
        setFormErrors({
          general: err instanceof Error ? err.message : "Failed to register property. Please try again.",
        });
      }
    } finally {
      setSubmitting(false);
      setUploadStatus(null);
    }
  };

  const isFormValid =
    name.trim().length > 0 &&
    address.trim().length > 0 &&
    ownerName.trim().length > 0 &&
    selectedFiles.length > 0 &&
    selectedFiles.length <= 5;

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
              {String(
                properties.reduce((acc, p) => acc + (p.linked_tenants_count || 0), 0)
              ).padStart(2, "0")}{" "}
              LINKED TENANTS
            </span>
          </div>
        </div>

        <button
          onClick={openAddModal}
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
            No Properties Registered Yet
          </h2>
          <p className="text-xs text-ink-600 leading-relaxed mb-6 max-w-md mx-auto">
            Register your rental property with private ownership documents to generate a secure join code. Share the code with your tenant so they can link their inspection records.
          </p>
          <button
            onClick={openAddModal}
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
                <th className="py-3 px-4 font-semibold">PROPERTY & ADDRESS</th>
                <th className="py-3 px-4 font-semibold">OWNER NAME</th>
                <th className="py-3 px-4 font-semibold">JOIN CODE</th>
                <th className="py-3 px-4 font-semibold">DOCUMENTS</th>
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
                      <span className="text-[11px] text-ink-500 font-normal mt-0.5">
                        {prop.address || "No address specified"}
                      </span>
                    </Link>
                  </td>
                  <td className="py-4 px-4 font-mono text-[11px] text-ink-700 whitespace-nowrap align-top">
                    {prop.owner_name || "—"}
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
                    {prop.documents_missing ? (
                      <span className="inline-block px-2 py-0.5 text-[10px] font-mono uppercase font-semibold bg-wear-bg text-wear border border-wear-border">
                        DOCUMENTS MISSING
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 text-[10px] font-mono uppercase font-semibold bg-page text-ink-700 border border-ink-200">
                        {prop.documents_count || 0} {(prop.documents_count === 1 ? "FILE" : "FILES")}
                      </span>
                    )}
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
          onClick={openAddModal}
          className="px-4 py-2.5 bg-surface hover:bg-white text-ink-900 border border-ink-300 hover:border-ink-500 text-xs font-semibold uppercase tracking-wider font-mono transition-colors whitespace-nowrap btn-motion lit min-h-[48px] sm:min-h-0"
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
                onClick={() => {
                  if (!submitting) setShowAddModal(false);
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
                  Property Name <span className="text-damage">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Flat 402, Oakwood Towers"
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
                  placeholder="e.g. 14th Main Road, Sector 3, HSR Layout, Bengaluru"
                  disabled={submitting || !!createdPropertyId}
                  className={`w-full px-3 py-2 border bg-page focus:bg-surface focus:outline-none ${
                    formErrors.address ? "border-damage" : "border-ink-200 focus:border-accent"
                  }`}
                />
                {formErrors.address && (
                  <p className="text-damage mt-1 font-mono text-[11px]">{formErrors.address}</p>
                )}
              </div>

              <div>
                <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                  Owner Name <span className="text-damage">*</span>
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Vikram Mehta"
                  disabled={submitting || !!createdPropertyId}
                  className={`w-full px-3 py-2 border bg-page focus:bg-surface focus:outline-none ${
                    formErrors.owner_name ? "border-damage" : "border-ink-200 focus:border-accent"
                  }`}
                />
                {formErrors.owner_name && (
                  <p className="text-damage mt-1 font-mono text-[11px]">{formErrors.owner_name}</p>
                )}
              </div>

              {/* Document upload container */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider">
                    Property Evidence Documents <span className="text-damage">*</span>
                  </label>
                  <span className="text-[10px] font-mono text-ink-500">
                    {selectedFiles.length} / 5 files
                  </span>
                </div>
                <p className="text-[11px] text-ink-500 mb-2">
                  For example ownership proof, sale deed, property tax receipt.
                </p>

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
                    if (!submitting) handleFileSelection(e.dataTransfer.files);
                  }}
                  onClick={() => {
                    if (!submitting) fileInputRef.current?.click();
                  }}
                  className={`border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? "border-accent bg-accent-tint/30"
                      : formErrors.documents
                      ? "border-damage bg-damage-bg/20"
                      : "border-ink-200 hover:border-ink-400 bg-page"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFileSelection(e.target.files)}
                    disabled={submitting}
                    className="hidden"
                  />
                  <div className="font-mono text-xs text-ink-800 font-semibold">
                    Click or drag & drop documents here
                  </div>
                  <div className="text-[10px] font-mono text-ink-500 mt-1">
                    PDF, JPEG, PNG, or WebP (max 10 MB per file, up to 5 files)
                  </div>
                </div>

                <p className="text-[10px] font-mono text-ink-500 mt-1.5">
                  Stored privately. Only you can open it. Do not upload ID numbers or bank details.
                </p>

                {formErrors.documents && (
                  <p className="text-damage mt-1 font-mono text-[11px]">{formErrors.documents}</p>
                )}

                {/* Selected files list */}
                {selectedFiles.length > 0 && (
                  <div className="mt-3 border border-ink-200 divide-y divide-ink-100 bg-surface">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2 flex items-center justify-between text-xs font-mono"
                      >
                        <div className="truncate max-w-[280px]">
                          <span className="font-medium text-ink-900 truncate block">
                            {file.name}
                          </span>
                          <span className="text-[10px] text-ink-500">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB · {file.type.split("/")[1]?.toUpperCase() || "FILE"}
                          </span>
                        </div>
                        {!submitting && !createdPropertyId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFile(idx);
                            }}
                            className="text-damage hover:underline text-[10px] uppercase font-bold"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
                    : failedFiles.length > 0
                    ? "Retry Upload"
                    : "+ Register Property"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
