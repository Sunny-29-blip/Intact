"use client";

import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { api, ApiError } from "@/lib/api";
import { uploadAndRegisterDocument } from "@/lib/client-document";
import { updateOwnerPropertySchema, type UpdateOwnerPropertyInput } from "@/lib/validation";
import type { OwnerPropertyDetail, Document } from "@/types/database";

const ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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
  const [userId, setUserId] = useState<string | null>(null);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editOwnerName, setEditOwnerName] = useState("");
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Delete property modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Add document modal
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docUploadStatus, setDocUploadStatus] = useState<string | null>(null);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);

  // Remove document modal
  const [docToRemove, setDocToRemove] = useState<Document | null>(null);
  const [removingDoc, setRemovingDoc] = useState(false);

  // Copy feedback
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchProperty = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, { data: authData }] = await Promise.all([
        api.getOwnerProperty(propertyId),
        supabase.auth.getUser(),
      ]);

      setProperty(data);
      setEditName(data.name);
      setEditAddress(data.address || "");
      setEditOwnerName(data.owner_name || "");
      if (authData.user) {
        setUserId(authData.user.id);
      }
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
      name: editName.trim() || undefined,
      address: editAddress.trim() || undefined,
      owner_name: editOwnerName.trim() || undefined,
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

  const handleViewDocument = async (docId: string) => {
    try {
      const { signedUrl } = await api.getDocumentSignedUrl(docId);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to generate document link.");
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile || docUploading) return;
    setDocUploadError(null);

    if (!ALLOWED_MIMES.includes(docFile.type)) {
      setDocUploadError("Invalid file type. Only PDF, JPEG, PNG, and WebP are allowed.");
      return;
    }

    if (docFile.size > MAX_FILE_SIZE) {
      setDocUploadError("File exceeds 10 MB maximum limit.");
      return;
    }

    if ((property?.documents?.length || 0) >= 5) {
      setDocUploadError("Maximum of 5 documents allowed per property.");
      return;
    }

    const activeUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!activeUserId) {
      setDocUploadError("User authentication not ready. Please refresh.");
      return;
    }

    setDocUploading(true);
    try {
      await uploadAndRegisterDocument({
        userId: activeUserId,
        kind: "property_evidence",
        parentId: propertyId,
        file: docFile,
        onProgress: (status) => setDocUploadStatus(status),
      });

      setDocFile(null);
      setShowAddDocModal(false);
      await fetchProperty();
    } catch (err) {
      setDocUploadError(err instanceof Error ? err.message : "Failed to upload document.");
    } finally {
      setDocUploading(false);
      setDocUploadStatus(null);
    }
  };

  const handleRemoveDocument = async () => {
    if (!docToRemove || removingDoc) return;
    setRemovingDoc(true);
    try {
      await api.deleteDocument(docToRemove.id);
      setDocToRemove(null);
      await fetchProperty();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to remove document.");
    } finally {
      setRemovingDoc(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatSha = (sha?: string | null) => {
    if (!sha || sha.length < 12) return sha || "—";
    return `${sha.slice(0, 8)}…${sha.slice(-6)}`;
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
                  {property.owner_name && (
                    <p className="font-mono text-[11px] text-ink-500">
                      Owner: <strong className="text-ink-800">{property.owner_name}</strong>
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 self-start">
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="px-3 py-2 border border-ink-200 hover:border-ink-400 bg-page text-ink-800 text-xs font-semibold uppercase tracking-wider font-mono transition-colors btn-motion lit min-h-[44px] sm:min-h-0"
                >
                  Edit Property
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="px-3 py-2 border border-damage-border hover:bg-damage-bg text-damage text-xs font-semibold uppercase tracking-wider font-mono transition-colors btn-motion min-h-[44px] sm:min-h-0"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Join Code Banner & Document Metrics */}
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
                  DOCUMENTS ATTACHED
                </div>
                <div className="text-2xl font-bold font-mono text-ink-900 mt-1">
                  {property.documents?.length || 0} / 5
                </div>
                <div className="text-[10px] font-mono text-ink-500 mt-0.5">
                  {property.documents?.length === 0 ? "Documents missing" : "Stored privately"}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Property Evidence Documents */}
          <div className="bg-surface border border-ink-200 p-6 sm:p-8">
            <div className="border-b border-ink-200 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                  SECTION 02 · PROPERTY DOCUMENTS
                </div>
                <h2 className="text-xl font-bold text-ink-900 mt-0.5">
                  Documents Related to Property
                </h2>
                <p className="text-xs text-ink-600 mt-1">
                  Private property evidence documents (e.g. ownership proof, sale deed, tax receipt).
                </p>
              </div>

              {((property.documents?.length || 0) < 5) && (
                <button
                  onClick={() => {
                    setDocFile(null);
                    setDocUploadError(null);
                    setShowAddDocModal(true);
                  }}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider font-mono transition-colors self-start sm:self-auto btn-motion lit-dark min-h-[44px] sm:min-h-0 whitespace-nowrap"
                >
                  + Add document
                </button>
              )}
            </div>

            {(!property.documents || property.documents.length === 0) ? (
              <div className="border border-dashed border-damage-border bg-damage-bg/20 p-8 text-center">
                <div className="text-xs font-mono text-damage uppercase font-bold tracking-wider mb-1">
                  [!] DOCUMENTS MISSING
                </div>
                <p className="text-xs text-ink-700 max-w-md mx-auto mb-4">
                  No property evidence documents are currently stored. Add at least one document to complete your property register entry.
                </p>
                <button
                  onClick={() => {
                    setDocFile(null);
                    setDocUploadError(null);
                    setShowAddDocModal(true);
                  }}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider font-mono transition-colors btn-motion lit-dark"
                >
                  + Add document
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border border-ink-200 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-ink-200 bg-page text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                        <th className="py-3 px-4 font-semibold">DOCUMENT NAME</th>
                        <th className="py-3 px-4 font-semibold">TYPE</th>
                        <th className="py-3 px-4 font-semibold">SIZE</th>
                        <th className="py-3 px-4 font-semibold">ADDED ON</th>
                        <th className="py-3 px-4 font-semibold">CHECKSUM (SHA-256)</th>
                        <th className="py-3 px-4 font-semibold text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 font-sans">
                      {property.documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-page/60 transition-colors">
                          <td className="py-3.5 px-4 font-medium text-ink-900">
                            <span className="font-semibold block truncate max-w-xs" title={doc.original_name}>
                              {doc.original_name}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-ink-600 uppercase whitespace-nowrap">
                            {doc.mime_type.split("/")[1] || "FILE"}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-ink-600 whitespace-nowrap">
                            {formatFileSize(doc.size_bytes)}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-ink-600 whitespace-nowrap">
                            {new Date(doc.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-ink-500 whitespace-nowrap" title={doc.sha256 || undefined}>
                            {formatSha(doc.sha256)}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleViewDocument(doc.id)}
                                className="text-xs font-mono text-accent hover:underline font-semibold"
                              >
                                View ↗
                              </button>
                              <button
                                type="button"
                                onClick={() => setDocToRemove(doc)}
                                className="text-xs font-mono text-damage hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-page border border-ink-200 text-ink-600 font-mono text-[11px]">
                  <strong>PRIVACY NOTE:</strong> Intact stores these files privately for you. It does not verify them.
                </div>
              </div>
            )}
          </div>

          {/* Linked Tenants Section */}
          <div className="bg-surface border border-ink-200 p-6 sm:p-8">
            <div className="border-b border-ink-200 pb-4 mb-6">
              <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                SECTION 03 · LINKED TENANTS
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

      {/* Add Document Modal */}
      {showAddDocModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-ink-200 max-w-lg w-full p-6 text-xs">
            <div className="border-b border-ink-200 pb-3 mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase text-ink-500">
                  PROPERTY EVIDENCE · UPLOAD
                </div>
                <h2 className="text-base font-bold text-ink-900">
                  Add Evidence Document
                </h2>
              </div>
              <button
                onClick={() => {
                  if (!docUploading) setShowAddDocModal(false);
                }}
                disabled={docUploading}
                className="text-ink-500 hover:text-ink-900 font-mono text-sm"
              >
                [✕]
              </button>
            </div>

            {docUploadError && (
              <div className="mb-4 p-3 bg-damage-bg border border-damage-border text-damage font-mono">
                [!] {docUploadError}
              </div>
            )}

            {docUploadStatus && (
              <div className="mb-4 p-3 bg-accent-tint border border-accent-border text-accent font-mono animate-pulse">
                {docUploadStatus}
              </div>
            )}

            <form onSubmit={handleAddDocument} className="space-y-4">
              <div>
                <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                  Select Document File <span className="text-damage">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  disabled={docUploading}
                  className="w-full text-xs text-ink-700 file:mr-2 file:py-1.5 file:px-3 file:border file:border-ink-200 file:bg-surface file:text-xs file:font-mono hover:file:bg-page"
                />
                <p className="text-[10px] font-mono text-ink-500 mt-1.5">
                  PDF, JPEG, PNG, or WebP (max 10 MB). Stored privately. Only you can open it. Do not upload ID numbers or bank details.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => setShowAddDocModal(false)}
                  disabled={docUploading}
                  className="px-4 py-2 border border-ink-200 hover:border-ink-400 bg-surface text-ink-700 text-xs font-semibold uppercase tracking-wider transition-colors btn-motion lit"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={docUploading || !docFile}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 btn-motion lit-dark"
                >
                  {docUploading ? "Uploading..." : "+ Upload Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Document Confirmation Modal */}
      {docToRemove && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-damage-border max-w-md w-full p-6 text-xs">
            <div className="border-b border-ink-200 pb-3 mb-4">
              <div className="text-[10px] font-mono uppercase text-damage font-bold tracking-wider">
                CONFIRM REMOVAL
              </div>
              <h2 className="text-base font-bold text-ink-900 mt-1">
                Remove Evidence Document?
              </h2>
            </div>
            <p className="text-ink-600 mb-6 leading-relaxed">
              Are you sure you want to remove <strong>{docToRemove.original_name}</strong>? It will be permanently deleted from secure private storage.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDocToRemove(null)}
                disabled={removingDoc}
                className="px-4 py-2 border border-ink-200 hover:border-ink-400 bg-surface text-ink-700 text-xs font-semibold uppercase tracking-wider transition-colors btn-motion lit"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveDocument}
                disabled={removingDoc}
                className="px-4 py-2 bg-damage hover:bg-damage/90 text-white text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 btn-motion"
              >
                {removingDoc ? "Removing..." : "Remove Document"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Property Modal */}
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
                  Property Name <span className="text-damage">*</span>
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
                  Address <span className="text-damage">*</span>
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className={`w-full px-3 py-2 border bg-page focus:bg-surface focus:outline-none ${
                    editErrors.address ? "border-damage" : "border-ink-200 focus:border-accent"
                  }`}
                />
                {editErrors.address && (
                  <p className="text-damage mt-1 font-mono text-[11px]">{editErrors.address}</p>
                )}
              </div>

              <div>
                <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                  Owner Name <span className="text-damage">*</span>
                </label>
                <input
                  type="text"
                  value={editOwnerName}
                  onChange={(e) => setEditOwnerName(e.target.value)}
                  className={`w-full px-3 py-2 border bg-page focus:bg-surface focus:outline-none ${
                    editErrors.owner_name ? "border-damage" : "border-ink-200 focus:border-accent"
                  }`}
                />
                {editErrors.owner_name && (
                  <p className="text-damage mt-1 font-mono text-[11px]">{editErrors.owner_name}</p>
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
              Are you sure you want to delete <strong className="text-ink-900">{property?.name}</strong>? All linked tenancy links and uploaded private documents for this property will be permanently deleted. This action cannot be undone.
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
