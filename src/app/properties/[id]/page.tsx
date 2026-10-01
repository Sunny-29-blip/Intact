"use client";

import { useEffect, useState, use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { api, ApiError } from "@/lib/api";
import { uploadAndRegisterPhoto } from "@/lib/client-photo";
import { uploadAndRegisterDocument } from "@/lib/client-document";
import { updatePropertySchema, type UpdatePropertyInput } from "@/lib/validation";
import { AreaComparisonCard } from "@/components/AreaComparisonCard";
import type {
  PropertyDetail,
  PhotoWithUrl,
  ComparisonWithFindings,
  TenantLinkedOwnerProperty,
  Document,
} from "@/types/database";

const ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PropertyDetailPage({ params }: PageProps) {
  const { id: propertyId } = use(params);
  const router = useRouter();

  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [comparisons, setComparisons] = useState<ComparisonWithFindings[]>([]);
  const [tenancyLink, setTenancyLink] = useState<TenantLinkedOwnerProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  // Link to owner property state
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [linkingOwner, setLinkingOwner] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);
  const [updatingShare, setUpdatingShare] = useState(false);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  // Contract management state
  const [showContractModal, setShowContractModal] = useState(false);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [contractUploading, setContractUploading] = useState(false);
  const [contractUploadStatus, setContractUploadStatus] = useState<string | null>(null);
  const [contractUploadError, setContractUploadError] = useState<string | null>(null);
  const [showRemoveContractModal, setShowRemoveContractModal] = useState(false);
  const [removingContract, setRemovingContract] = useState(false);

  // Edit property state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTenantName, setEditTenantName] = useState("");
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editTenancyStart, setEditTenancyStart] = useState("");
  const [editTenancyEnd, setEditTenancyEnd] = useState("");
  const [editLeaseNotes, setEditLeaseNotes] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete property confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Move-in upload state
  const [moveInArea, setMoveInArea] = useState("");
  const [moveInFile, setMoveInFile] = useState<File | null>(null);
  const [moveInUploading, setMoveInUploading] = useState(false);
  const [moveInStatusText, setMoveInStatusText] = useState<string | null>(null);
  const [moveInError, setMoveInError] = useState<string | null>(null);

  // Move-out upload state
  const [moveOutArea, setMoveOutArea] = useState("");
  const [moveOutFile, setMoveOutFile] = useState<File | null>(null);
  const [moveOutUploading, setMoveOutUploading] = useState(false);
  const [moveOutStatusText, setMoveOutStatusText] = useState<string | null>(null);
  const [moveOutError, setMoveOutError] = useState<string | null>(null);

  // Delete photo state
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  const fetchPropertyAndComparisons = async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }

      const [propData, compData, linksData] = await Promise.all([
        api.getProperty(propertyId),
        api.getComparisons(propertyId).catch(() => [] as ComparisonWithFindings[]),
        api.getTenantLinks().catch(() => [] as TenantLinkedOwnerProperty[]),
      ]);

      setProperty(propData);
      setComparisons(compData);

      const existingLink = linksData.find((l) => l.tenant_property_id === propertyId);
      setTenancyLink(existingLink || null);

      // Populate edit fields
      setEditTenantName(propData.tenant_name || "");
      setEditName(propData.name);
      setEditAddress(propData.address || "");
      setEditTenancyStart(propData.tenancy_start);
      setEditTenancyEnd(propData.tenancy_end || "");
      setEditLeaseNotes(propData.lease_notes || "");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load property record.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLinkOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError(null);
    setLinkSuccess(null);

    const cleanCode = joinCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setLinkError("Please enter an 8-character join code.");
      return;
    }

    setLinkingOwner(true);
    try {
      const newLink = await api.linkTenancy({
        joinCode: cleanCode,
        propertyId,
      });
      setTenancyLink(newLink);
      setJoinCodeInput("");
      setLinkSuccess(`Successfully linked to ${newLink.name}`);
      setTimeout(() => setLinkSuccess(null), 4000);
    } catch (err) {
      if (err instanceof ApiError) {
        setLinkError(err.message);
      } else {
        setLinkError("Code not recognised. Please check with your property owner.");
      }
    } finally {
      setLinkingOwner(false);
    }
  };

  const handleToggleShare = async () => {
    if (!tenancyLink) return;
    setUpdatingShare(true);
    try {
      const updated = await api.updateLinkShare(tenancyLink.link_id, !tenancyLink.shared);
      setTenancyLink((prev) => (prev ? { ...prev, shared: updated.shared } : null));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to update sharing preference.");
    } finally {
      setUpdatingShare(false);
    }
  };

  const handleUnlink = async () => {
    if (!tenancyLink) return;
    setUnlinking(true);
    try {
      await api.unlinkTenancy(tenancyLink.link_id);
      setTenancyLink(null);
      setShowUnlinkModal(false);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to unlink property.");
    } finally {
      setUnlinking(false);
    }
  };

  const handleViewContract = async () => {
    if (!property?.contract?.id) return;
    try {
      const { signedUrl } = await api.getDocumentSignedUrl(property.contract.id);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to load contract URL.");
    }
  };

  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractFile || contractUploading) return;
    setContractUploadError(null);

    if (!ALLOWED_MIMES.includes(contractFile.type)) {
      setContractUploadError("Invalid file type. Only PDF, JPEG, PNG, and WebP are allowed.");
      return;
    }

    if (contractFile.size > MAX_FILE_SIZE) {
      setContractUploadError("File exceeds 10 MB maximum limit.");
      return;
    }

    const activeUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!activeUserId) {
      setContractUploadError("User authentication not ready. Please refresh.");
      return;
    }

    setContractUploading(true);
    try {
      await uploadAndRegisterDocument({
        userId: activeUserId,
        kind: "tenancy_contract",
        parentId: propertyId,
        file: contractFile,
        onProgress: (status) => setContractUploadStatus(status),
      });

      setContractFile(null);
      setShowContractModal(false);
      await fetchPropertyAndComparisons();
    } catch (err) {
      setContractUploadError(err instanceof Error ? err.message : "Failed to upload contract.");
    } finally {
      setContractUploading(false);
      setContractUploadStatus(null);
    }
  };

  const handleRemoveContract = async () => {
    if (!property?.contract?.id || removingContract) return;
    setRemovingContract(true);
    try {
      await api.deleteDocument(property.contract.id);
      setShowRemoveContractModal(false);
      await fetchPropertyAndComparisons();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to remove contract.");
    } finally {
      setRemovingContract(false);
    }
  };

  useEffect(() => {
    fetchPropertyAndComparisons();
  }, [propertyId]);

  const moveInPhotos = useMemo(
    () => property?.inspections.move_in?.photos || [],
    [property]
  );
  const moveOutPhotos = useMemo(
    () => property?.inspections.move_out?.photos || [],
    [property]
  );

  const availableMoveInAreas = useMemo(() => {
    const set = new Set<string>();
    moveInPhotos.forEach((p) => set.add(p.area));
    return Array.from(set).sort();
  }, [moveInPhotos]);

  const pairedAreas = useMemo(() => {
    const map = new Map<
      string,
      { area: string; moveIn?: PhotoWithUrl; moveOut?: PhotoWithUrl }
    >();

    moveInPhotos.forEach((p) => {
      const entry = map.get(p.area) || { area: p.area };
      entry.moveIn = p;
      map.set(p.area, entry);
    });

    moveOutPhotos.forEach((p) => {
      const entry = map.get(p.area) || { area: p.area };
      entry.moveOut = p;
      map.set(p.area, entry);
    });

    return Array.from(map.values());
  }, [moveInPhotos, moveOutPhotos]);

  const handleEditProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    const payload: UpdatePropertyInput = {
      tenant_name: editTenantName.trim() || undefined,
      name: editName.trim() || undefined,
      address: editAddress.trim() || undefined,
      tenancy_start: editTenancyStart || undefined,
      tenancy_end: editTenancyEnd || null,
      lease_notes: editLeaseNotes.trim() || null,
    };

    const validation = updatePropertySchema.safeParse(payload);
    if (!validation.success) {
      setEditError("Please fill out all required fields properly.");
      return;
    }

    setEditSubmitting(true);
    try {
      await api.updateProperty(propertyId, payload);
      setShowEditModal(false);
      await fetchPropertyAndComparisons();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Failed to update property.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteProperty = async () => {
    setDeleting(true);
    try {
      await api.deleteProperty(propertyId);
      router.push("/properties");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete property.");
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleMoveInUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setMoveInError(null);

    if (!moveInArea.trim()) {
      setMoveInError("Please enter an area name (e.g. Master Bedroom — East Wall)");
      return;
    }
    if (!moveInFile) {
      setMoveInError("Please select a photo to upload");
      return;
    }
    if (!property?.inspections.move_in?.id || !userId) {
      setMoveInError("Inspection session not ready. Please refresh.");
      return;
    }

    setMoveInUploading(true);
    try {
      await uploadAndRegisterPhoto({
        userId,
        propertyId,
        inspectionId: property.inspections.move_in.id,
        inspectionKind: "move_in",
        area: moveInArea.trim(),
        file: moveInFile,
        onProgress: (status) => setMoveInStatusText(status),
      });

      setMoveInArea("");
      setMoveInFile(null);
      setMoveInStatusText(null);
      await fetchPropertyAndComparisons();
    } catch (err) {
      setMoveInError(err instanceof Error ? err.message : "Failed to upload photo.");
    } finally {
      setMoveInUploading(false);
      setMoveInStatusText(null);
    }
  };

  const handleMoveOutUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setMoveOutError(null);

    if (!moveOutArea) {
      setMoveOutError("Please select an area matching your move-in baseline");
      return;
    }
    if (!moveOutFile) {
      setMoveOutError("Please select a photo to upload");
      return;
    }
    if (!property?.inspections.move_out?.id || !userId) {
      setMoveOutError("Inspection session not ready. Please refresh.");
      return;
    }

    setMoveOutUploading(true);
    try {
      await uploadAndRegisterPhoto({
        userId,
        propertyId,
        inspectionId: property.inspections.move_out.id,
        inspectionKind: "move_out",
        area: moveOutArea,
        file: moveOutFile,
        onProgress: (status) => setMoveOutStatusText(status),
      });

      setMoveOutArea("");
      setMoveOutFile(null);
      setMoveOutStatusText(null);
      await fetchPropertyAndComparisons();
    } catch (err) {
      setMoveOutError(err instanceof Error ? err.message : "Failed to upload photo.");
    } finally {
      setMoveOutUploading(false);
      setMoveOutStatusText(null);
    }
  };

  const handleDirectUpload = async (area: string, kind: "move_in" | "move_out", file: File) => {
    if (!property || !userId) return;
    const inspection = kind === "move_in" ? property.inspections.move_in : property.inspections.move_out;
    if (!inspection) return;

    await uploadAndRegisterPhoto({
      userId,
      propertyId,
      inspectionId: inspection.id,
      inspectionKind: kind,
      area,
      file,
    });

    await fetchPropertyAndComparisons();
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm("Are you sure you want to remove this inspection photo?")) {
      return;
    }

    setDeletingPhotoId(photoId);
    try {
      await api.deletePhoto(photoId);
      await fetchPropertyAndComparisons();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete photo");
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const handleComparisonUpdated = (updated: ComparisonWithFindings) => {
    setComparisons((prev) => {
      const existingIdx = prev.findIndex((c) => c.area === updated.area);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = updated;
        return next;
      }
      return [...prev, updated];
    });
  };

  const copyShareLink = () => {
    if (!property) return;
    const shareUrl = `${window.location.origin}/report/${property.share_token}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  const formatSha = (sha?: string | null) => {
    if (!sha || sha.length < 12) return sha || "—";
    return `${sha.slice(0, 8)}…${sha.slice(-6)}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getContractExpiryStatus = (endDateStr?: string | null) => {
    if (!endDateStr) return null;
    const end = new Date(endDateStr);
    if (isNaN(end.getTime())) return null;
    const now = new Date();
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffDays = Math.round((endDay - nowDay) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} ago (${endDateStr})`;
    }
    if (diffDays === 0) {
      return "Expires today";
    }
    return `Expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const getPropertyRef = (id: string) => {
    const clean = id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
    return `PR-${clean || "1001"}`;
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Breadcrumb & Property Reference */}
      <div className="flex items-center space-x-2 text-xs font-mono text-ink-500 mb-4">
        <Link href="/properties" className="hover:text-ink-900 underline">
          REGISTER
        </Link>
        <span>/</span>
        <span className="text-ink-900 font-semibold font-mono">
          {property ? getPropertyRef(property.id) : "DOSSIER"}
        </span>
        <span>/</span>
        <span className="text-ink-600 truncate max-w-xs">
          {property?.name || "Loading..."}
        </span>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="border border-ink-200 bg-surface p-8 animate-pulse space-y-4">
          <div className="h-5 bg-page w-1/3"></div>
          <div className="h-4 bg-page w-1/2"></div>
          <div className="h-32 bg-page"></div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-damage-bg border border-damage-border text-xs text-damage mb-6 flex items-center justify-between font-mono">
          <span>[!] {error}</span>
          <button
            onClick={fetchPropertyAndComparisons}
            className="underline font-semibold hover:text-damage"
          >
            Retry
          </button>
        </div>
      )}

      {/* Property Details Header */}
      {!loading && property && (
        <>
          <div className="border border-ink-200 bg-surface p-6 sm:p-8 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-ink-200 pb-5">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-ink-500 tracking-wider mb-1">
                  <span className="font-bold text-accent">{getPropertyRef(property.id)}</span>
                  <span>·</span>
                  <span>PROPERTY RECORD</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-900">
                  {property.name}
                </h1>
                <div className="mt-1 space-y-0.5">
                  {property.address && (
                    <p className="text-xs text-ink-600 font-sans">{property.address}</p>
                  )}
                  {property.tenant_name && (
                    <p className="text-[11px] font-mono text-ink-500">
                      Tenant: <strong className="text-ink-800">{property.tenant_name}</strong>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/report/${property.share_token}`}
                  target="_blank"
                  className="px-3.5 py-2 text-xs font-semibold text-accent hover:bg-accent-tint border border-accent-border transition-colors uppercase tracking-wider btn-motion lit"
                >
                  View Inspection Report ↗
                </Link>
                <button
                  onClick={copyShareLink}
                  className="px-3 py-2 text-xs font-semibold text-ink-700 hover:text-ink-900 border border-ink-200 hover:border-ink-400 bg-surface transition-colors uppercase font-mono tracking-wider btn-motion lit"
                >
                  {copiedShare ? "✓ Copied" : "Copy Landlord Link"}
                </button>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="px-3 py-2 text-xs font-semibold text-ink-700 hover:text-ink-900 border border-ink-200 hover:border-ink-400 bg-surface transition-colors font-mono uppercase btn-motion lit"
                >
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-3 py-2 text-xs font-semibold text-damage hover:bg-damage-bg border border-damage-border transition-colors font-mono uppercase btn-motion lit"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Tenancy & Inspection Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 text-xs font-mono">
              <div>
                <span className="block text-[10px] uppercase text-ink-500">
                  Contract Period
                </span>
                <span className="font-semibold text-ink-900 mt-0.5 block text-[11px]">
                  {property.tenancy_start}
                  {property.tenancy_end ? ` → ${property.tenancy_end}` : " (Current)"}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-ink-500">
                  Contract Status
                </span>
                <span className="font-semibold text-ink-900 mt-0.5 block text-[11px]">
                  {property.contract ? (
                    <span className="text-accepted">Attached</span>
                  ) : (
                    <span className="text-damage">Missing</span>
                  )}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-ink-500">
                  Move-In Baseline
                </span>
                <span className="font-semibold text-ink-900 mt-0.5 block">
                  {moveInPhotos.length} {moveInPhotos.length === 1 ? "area" : "areas"}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-ink-500">
                  Move-Out Paired
                </span>
                <span className="font-semibold text-ink-900 mt-0.5 block">
                  {moveOutPhotos.length} of {availableMoveInAreas.length || 0} areas
                </span>
              </div>
            </div>

            {property.lease_notes && (
              <div className="mt-5 pt-4 border-t border-ink-100 text-xs text-ink-700 bg-page p-3.5 border border-ink-200">
                <span className="font-semibold font-mono uppercase text-ink-600 mr-2 text-[10px]">
                  Lease Terms / Notes:
                </span>
                <span className="font-sans">{property.lease_notes}</span>
              </div>
            )}
          </div>

          {/* Section: Tenancy Contract */}
          <div className="border border-ink-200 bg-surface p-6 sm:p-8 mb-8">
            <div className="border-b border-ink-200 pb-4 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                  SECTION · TENANCY CONTRACT
                </div>
                <h2 className="text-lg font-bold text-ink-900 mt-0.5">
                  Tenancy Contract
                </h2>
                <p className="text-xs text-ink-600 mt-0.5">
                  Your private contract with the property owner.
                </p>
              </div>

              {property.contract && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleViewContract}
                    className="px-3 py-1.5 border border-ink-200 hover:border-ink-400 bg-page text-ink-800 text-xs font-semibold uppercase tracking-wider font-mono transition-colors btn-motion lit"
                  >
                    View ↗
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setContractFile(null);
                      setContractUploadError(null);
                      setShowContractModal(true);
                    }}
                    className="px-3 py-1.5 border border-ink-200 hover:border-ink-400 bg-page text-ink-800 text-xs font-semibold uppercase tracking-wider font-mono transition-colors btn-motion lit"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRemoveContractModal(true)}
                    className="px-3 py-1.5 border border-damage-border hover:bg-damage-bg text-damage text-xs font-semibold uppercase tracking-wider font-mono transition-colors btn-motion"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {property.contract ? (
              <div className="space-y-4">
                <div className="p-4 bg-page border border-ink-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
                  <div>
                    <span className="block text-[10px] uppercase text-ink-500">File Name</span>
                    <span className="font-semibold text-ink-900 block truncate mt-0.5" title={property.contract.original_name}>
                      {property.contract.original_name}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-ink-500">Type & Size</span>
                    <span className="text-ink-700 block mt-0.5 uppercase">
                      {property.contract.mime_type.split("/")[1] || "DOCUMENT"} · {formatFileSize(property.contract.size_bytes)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-ink-500">Added Date</span>
                    <span className="text-ink-700 block mt-0.5">
                      {new Date(property.contract.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-ink-500">Valid Until</span>
                    <div className="mt-0.5 flex flex-col">
                      <span className="font-semibold text-ink-900">
                        {property.tenancy_end || "Not specified"}
                      </span>
                      {getContractExpiryStatus(property.tenancy_end) && (
                        <span className="text-[10px] text-ink-500 mt-0.5">
                          {getContractExpiryStatus(property.tenancy_end)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-page border border-ink-200 text-ink-600 font-mono text-[11px]">
                  <strong>PRIVACY NOTE:</strong> Intact stores these files privately for you. It does not verify them.
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-ink-200 p-6 bg-page text-center">
                <div className="text-xs font-mono text-ink-500 uppercase tracking-wider mb-1">
                  CONTRACT NOT ADDED
                </div>
                <p className="text-xs text-ink-600 max-w-md mx-auto mb-4">
                  No tenancy contract is currently attached to this property. Uploading your agreement stores it privately and links it with your inspection baseline.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setContractFile(null);
                    setContractUploadError(null);
                    setShowContractModal(true);
                  }}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider font-mono transition-colors btn-motion lit-dark"
                >
                  + Add contract
                </button>
              </div>
            )}
          </div>

          {/* Section: Linked Owner Property */}
          <div className="border border-ink-200 bg-surface p-6 sm:p-8 mb-8">
            <div className="border-b border-ink-200 pb-4 mb-5">
              <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                OWNER INTEGRATION · {tenancyLink ? "LINKED" : "UNLINKED"}
              </div>
              <h2 className="text-lg font-bold text-ink-900 mt-0.5">
                Linked Owner Property
              </h2>
            </div>

            {linkSuccess && (
              <div className="mb-4 p-3 bg-accepted-bg border border-accepted-border text-accepted font-mono text-xs">
                [✓] {linkSuccess}
              </div>
            )}

            {tenancyLink ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-page border border-ink-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                      REGISTERED OWNER PROPERTY
                    </div>
                    <div className="text-sm font-bold text-ink-900 mt-0.5">
                      {tenancyLink.name}
                    </div>
                    {(tenancyLink.address || tenancyLink.city) && (
                      <div className="text-ink-600 text-xs mt-0.5">
                        {[tenancyLink.address, tenancyLink.city]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    )}
                    <div className="text-[10px] font-mono text-ink-500 mt-1">
                      Linked on{" "}
                      {new Date(tenancyLink.linked_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowUnlinkModal(true)}
                    className="px-3 py-2 border border-damage-border hover:bg-damage-bg text-damage text-xs font-semibold uppercase tracking-wider font-mono transition-colors self-start sm:self-auto btn-motion"
                  >
                    Unlink Property
                  </button>
                </div>

                {/* Share switch */}
                <div className="p-4 border border-ink-200 bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="font-bold text-ink-900 flex items-center gap-2">
                      <span>Share this report with the owner</span>
                      <span
                        className={`text-[10px] font-mono uppercase px-1.5 py-0.2 border ${
                          tenancyLink.shared
                            ? "bg-accepted-bg text-accepted border-accepted-border font-bold"
                            : "bg-page text-ink-500 border-ink-200"
                        }`}
                      >
                        {tenancyLink.shared ? "ENABLED" : "OFF"}
                      </span>
                    </div>
                    <p className="text-ink-600 text-xs">
                      The owner can open your read-only condition report. They never receive raw access to private photos or email.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleShare}
                    disabled={updatingShare}
                    className={`px-4 py-2 text-xs font-semibold uppercase font-mono tracking-wider transition-colors disabled:opacity-50 whitespace-nowrap btn-motion ${
                      tenancyLink.shared
                        ? "bg-accepted-bg hover:bg-accepted-border text-accepted border border-accepted-border"
                        : "bg-accent hover:bg-accent-hover text-white lit-dark"
                    }`}
                  >
                    {updatingShare
                      ? "Updating..."
                      : tenancyLink.shared
                      ? "Revoke Owner Report"
                      : "Share Report with Owner"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <p className="text-ink-600 leading-relaxed max-w-2xl">
                  If your landlord or property owner has registered on Intact, enter their 8-character property join code below. Linking allows you to seamlessly share your final condition report with zero dispute over timestamps.
                </p>

                {linkError && (
                  <div className="p-3 bg-damage-bg border border-damage-border text-damage font-mono">
                    [!] {linkError}
                  </div>
                )}

                <form onSubmit={handleLinkOwner} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-lg">
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. 8F2K9M4X"
                    maxLength={10}
                    disabled={linkingOwner}
                    className="flex-1 px-3 py-2 border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent font-mono tracking-wider uppercase text-xs"
                  />
                  <button
                    type="submit"
                    disabled={linkingOwner || !joinCodeInput.trim()}
                    className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold uppercase tracking-wider font-mono text-xs transition-colors disabled:opacity-50 btn-motion lit-dark whitespace-nowrap"
                  >
                    {linkingOwner ? "Linking..." : "+ Link Property"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Area Register Summary (Lovable Section 15 Hierarchy) */}
          {pairedAreas.length > 0 && (
            <div className="border border-ink-200 bg-surface mb-8 overflow-hidden">
              <div className="bg-page border-b border-ink-200 px-5 py-3 flex items-center justify-between">
                <div className="text-[10px] font-mono uppercase text-ink-500 font-bold tracking-wider">
                  AREA REGISTER · {pairedAreas.length} AREAS
                </div>
                <div className="text-[10px] font-mono text-ink-500">
                  {comparisons.filter((c) => c.status === "complete").length} COMPARED
                </div>
              </div>
              <div className="divide-y divide-ink-100 text-xs">
                {pairedAreas.map((item, idx) => {
                  const comp = comparisons.find((c) => c.area === item.area);
                  const isCompComplete = comp?.status === "complete";
                  const findingCount = comp?.findings.length || 0;

                  return (
                    <div
                      key={item.area}
                      className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-page/40 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-[11px] text-ink-400 font-bold w-6">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className="font-semibold text-ink-900 font-mono uppercase">
                          {item.area}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 font-mono text-[10px] pl-9 sm:pl-0">
                        <span
                          className={`px-2 py-0.5 border ${
                            item.moveIn
                              ? "bg-page text-ink-700 border-ink-200"
                              : "bg-wear-bg text-wear border-wear-border"
                          }`}
                        >
                          MOVE-IN: {item.moveIn ? "RECORDED" : "MISSING"}
                        </span>
                        <span
                          className={`px-2 py-0.5 border ${
                            item.moveOut
                              ? "bg-page text-ink-700 border-ink-200"
                              : "bg-wear-bg text-wear border-wear-border"
                          }`}
                        >
                          MOVE-OUT: {item.moveOut ? "RECORDED" : "PENDING"}
                        </span>
                        {isCompComplete ? (
                          <span
                            className={`px-2 py-0.5 font-bold border ${
                              findingCount === 0
                                ? "bg-accepted-bg text-accepted border-accepted-border"
                                : "bg-accent-tint text-accent border-accent-border"
                            }`}
                          >
                            {findingCount === 0
                              ? "NO DIFFERENCES"
                              : `${findingCount} FINDING${findingCount === 1 ? "" : "S"}`}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-ink-400 border border-ink-200">
                            UNCOMPARED
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 1: Move-In Baseline Recording */}
          <section className="border border-ink-200 bg-surface p-6 sm:p-8 mb-8">
            <div className="border-b border-ink-200 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-mono uppercase text-ink-500">
                  STAGE 01: ARRIVAL RECORD
                </div>
                <h2 className="text-lg font-bold text-ink-900">
                  Move-In Baseline Photos
                </h2>
              </div>
              <span className="text-xs font-mono text-ink-500">
                {moveInPhotos.length} areas documented
              </span>
            </div>

            {/* Move-in upload form */}
            <div className="bg-page border border-ink-200 p-4 sm:p-5 mb-6 text-xs">
              <h3 className="font-bold text-ink-900 mb-1 uppercase font-mono text-[11px]">
                Archive Move-In Baseline Photo
              </h3>
              <p className="text-ink-600 mb-4">
                Specify a descriptive area name (e.g. Master Bedroom — North Wall) and upload a high-resolution photo.
              </p>

              {moveInError && (
                <div className="mb-4 p-3 bg-damage-bg border border-damage-border text-damage">
                  {moveInError}
                </div>
              )}

              <form onSubmit={handleMoveInUpload} className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5">
                  <label className="block font-mono text-[10px] uppercase text-ink-700 mb-1">
                    Area Description <span className="text-damage">*</span>
                  </label>
                  <input
                    type="text"
                    value={moveInArea}
                    onChange={(e) => setMoveInArea(e.target.value)}
                    placeholder="e.g. Living Room — East Wall"
                    disabled={moveInUploading}
                    className="w-full px-3 py-2 border border-ink-200 bg-surface focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block font-mono text-[10px] uppercase text-ink-700 mb-1">
                    Baseline Photo <span className="text-damage">*</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setMoveInFile(e.target.files?.[0] || null)}
                    disabled={moveInUploading}
                    className="w-full text-xs text-ink-700 file:mr-2 file:py-1.5 file:px-3 file:border file:border-ink-200 file:bg-surface file:text-xs file:font-mono hover:file:bg-page"
                  />
                </div>

                <div className="md:col-span-3 flex items-end">
                  <button
                    type="submit"
                    disabled={moveInUploading || !moveInFile}
                    className="w-full py-2 px-3 bg-accent hover:bg-accent-hover text-white font-semibold uppercase tracking-wider text-xs transition-colors disabled:opacity-50 btn-motion lit-dark"
                  >
                    {moveInUploading ? (moveInStatusText || "Uploading...") : "+ Add Baseline Photo"}
                  </button>
                </div>
              </form>
            </div>

            {/* Move-in photo gallery */}
            {moveInPhotos.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-ink-200 text-xs text-ink-500 font-mono">
                No move-in photos archived yet. Add arrival photos above to establish your condition baseline.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {moveInPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="border border-ink-200 bg-page flex flex-col p-3 photo-frame lit"
                  >
                    <div className="aspect-[4/3] bg-ink-100 border border-ink-200 relative flex items-center justify-center overflow-hidden mb-2.5">
                      {photo.signed_url ? (
                        <img
                          src={photo.signed_url}
                          alt={photo.area}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xs text-ink-400 font-mono">Image loading...</span>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-between text-xs">
                      <div>
                        <div className="font-bold text-ink-900">{photo.area}</div>
                        <div className="font-mono text-[10px] text-ink-500 mt-1">
                          {formatDate(photo.created_at)}
                        </div>
                        <div className="font-mono text-[10px] text-ink-500 mt-0.5 truncate" title={photo.sha256}>
                          sha256 {formatSha(photo.sha256)}
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-ink-100 flex justify-end">
                        <button
                          onClick={() => handleDeletePhoto(photo.id)}
                          disabled={deletingPhotoId === photo.id}
                          className="text-[10px] font-mono text-damage hover:underline"
                        >
                          {deletingPhotoId === photo.id ? "Deleting..." : "Delete Photo"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 2: Move-Out Departure Pairing & AI Difference Review */}
          <section className="border border-ink-200 bg-surface p-6 sm:p-8">
            <div className="border-b border-ink-200 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-mono uppercase text-ink-500">
                  STAGE 02: DEPARTURE VERIFICATION & AI COMPARISON
                </div>
                <h2 className="text-lg font-bold text-ink-900">
                  Move-Out Pairing & Findings Review
                </h2>
              </div>
              <span className="text-xs font-mono text-ink-500">
                {moveOutPhotos.length} of {availableMoveInAreas.length} areas paired
              </span>
            </div>

            {/* Move-out upload form */}
            {availableMoveInAreas.length === 0 ? (
              <div className="p-4 bg-page border border-ink-200 text-xs text-ink-600 mb-6 font-mono">
                [!] Move-out photos require a baseline: Please upload move-in photos above first.
              </div>
            ) : (
              <div className="bg-page border border-ink-200 p-4 sm:p-5 mb-8 text-xs">
                <h3 className="font-bold text-ink-900 mb-1 uppercase font-mono text-[11px]">
                  Upload Matching Move-Out Photo
                </h3>
                <p className="text-ink-600 mb-4">
                  Select an area from your baseline to pair with the departure photograph.
                </p>

                {moveOutError && (
                  <div className="mb-4 p-3 bg-damage-bg border border-damage-border text-damage">
                    {moveOutError}
                  </div>
                )}

                <form onSubmit={handleMoveOutUpload} className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-5">
                    <label className="block font-mono text-[10px] uppercase text-ink-700 mb-1">
                      Target Baseline Area <span className="text-damage">*</span>
                    </label>
                    <select
                      value={moveOutArea}
                      onChange={(e) => setMoveOutArea(e.target.value)}
                      disabled={moveOutUploading}
                      className="w-full px-3 py-2 border border-ink-200 bg-surface focus:outline-none focus:border-accent"
                    >
                      <option value="">-- Select Move-In Area --</option>
                      {availableMoveInAreas.map((area) => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-4">
                    <label className="block font-mono text-[10px] uppercase text-ink-700 mb-1">
                      Departure Photo <span className="text-damage">*</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setMoveOutFile(e.target.files?.[0] || null)}
                      disabled={moveOutUploading}
                      className="w-full text-xs text-ink-700 file:mr-2 file:py-1.5 file:px-3 file:border file:border-ink-200 file:bg-surface file:text-xs file:font-mono hover:file:bg-page"
                    />
                  </div>

                  <div className="md:col-span-3 flex items-end">
                    <button
                      type="submit"
                      disabled={moveOutUploading || !moveOutFile || !moveOutArea}
                      className="w-full py-2 px-3 bg-accent hover:bg-accent-hover text-white font-semibold uppercase tracking-wider text-xs transition-colors disabled:opacity-50 btn-motion lit-dark"
                    >
                      {moveOutUploading ? (moveOutStatusText || "Uploading...") : "+ Pair Move-Out Photo"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* List of Area Comparison Cards */}
            {pairedAreas.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-ink-200 text-xs text-ink-500 font-mono">
                No area photo pairs established yet.
              </div>
            ) : (
              <div>
                {pairedAreas.map((item) => {
                  const comp = comparisons.find((c) => c.area === item.area);
                  return (
                    <AreaComparisonCard
                      key={item.area}
                      propertyId={propertyId}
                      area={item.area}
                      moveInPhoto={item.moveIn}
                      moveOutPhoto={item.moveOut}
                      comparison={comp}
                      onComparisonUpdated={handleComparisonUpdated}
                      onDeletePhoto={handleDeletePhoto}
                      deletingPhotoId={deletingPhotoId}
                      onDirectUpload={handleDirectUpload}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* Upload / Replace Contract Modal */}
      {showContractModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-ink-200 max-w-lg w-full p-6 text-xs">
            <div className="border-b border-ink-200 pb-3 mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase text-ink-500">
                  TENANCY AGREEMENT · UPLOAD
                </div>
                <h2 className="text-base font-bold text-ink-900">
                  {property?.contract ? "Replace Tenancy Contract" : "Upload Tenancy Contract"}
                </h2>
              </div>
              <button
                onClick={() => {
                  if (!contractUploading) setShowContractModal(false);
                }}
                disabled={contractUploading}
                className="text-ink-500 hover:text-ink-900 font-mono text-sm"
              >
                [✕]
              </button>
            </div>

            {contractUploadError && (
              <div className="mb-4 p-3 bg-damage-bg border border-damage-border text-damage font-mono">
                [!] {contractUploadError}
              </div>
            )}

            {contractUploadStatus && (
              <div className="mb-4 p-3 bg-accent-tint border border-accent-border text-accent font-mono animate-pulse">
                {contractUploadStatus}
              </div>
            )}

            <form onSubmit={handleSaveContract} className="space-y-4">
              <div>
                <label className="block font-mono font-medium text-ink-700 uppercase tracking-wider mb-1">
                  Select Contract File <span className="text-damage">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setContractFile(e.target.files?.[0] || null)}
                  disabled={contractUploading}
                  className="w-full text-xs text-ink-700 file:mr-2 file:py-1.5 file:px-3 file:border file:border-ink-200 file:bg-surface file:text-xs file:font-mono hover:file:bg-page"
                />
                <p className="text-[10px] font-mono text-ink-500 mt-1.5">
                  Stored privately. Only you can open it. Do not upload ID numbers or bank details.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => setShowContractModal(false)}
                  disabled={contractUploading}
                  className="px-4 py-2 border border-ink-200 hover:border-ink-400 bg-surface text-ink-700 text-xs font-semibold uppercase tracking-wider transition-colors btn-motion lit"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contractUploading || !contractFile}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 btn-motion lit-dark"
                >
                  {contractUploading ? "Uploading..." : property?.contract ? "Replace Contract" : "+ Upload Contract"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Contract Confirmation Modal */}
      {showRemoveContractModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-damage-border max-w-md w-full p-6 text-xs">
            <div className="border-b border-ink-200 pb-3 mb-4">
              <div className="text-[10px] font-mono uppercase text-damage font-bold tracking-wider">
                CONFIRM REMOVAL
              </div>
              <h2 className="text-base font-bold text-ink-900 mt-1">
                Remove Tenancy Contract?
              </h2>
            </div>
            <p className="text-ink-600 mb-6 leading-relaxed">
              Are you sure you want to remove your contract (<strong>{property?.contract?.original_name}</strong>)? It will be permanently deleted from secure private storage.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowRemoveContractModal(false)}
                disabled={removingContract}
                className="px-4 py-2 border border-ink-200 hover:border-ink-400 bg-surface text-ink-700 text-xs font-semibold uppercase tracking-wider transition-colors btn-motion lit"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveContract}
                disabled={removingContract}
                className="px-4 py-2 bg-damage hover:bg-damage/90 text-white text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 btn-motion"
              >
                {removingContract ? "Removing..." : "Remove Contract"}
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
                <div className="text-[10px] font-mono uppercase text-ink-500">EDIT RECORD</div>
                <h2 className="text-base font-bold text-ink-900">Update Property Details</h2>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-ink-500 hover:text-ink-900 font-mono text-sm"
              >
                [✕]
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 bg-damage-bg border border-damage-border text-xs text-damage font-mono">
                [!] {editError}
              </div>
            )}

            <form onSubmit={handleEditProperty} className="space-y-4 text-xs">
              <div>
                <label className="block font-mono text-[10px] uppercase text-ink-700 mb-1">
                  Your Name <span className="text-damage">*</span>
                </label>
                <input
                  type="text"
                  value={editTenantName}
                  onChange={(e) => setEditTenantName(e.target.value)}
                  className="w-full px-3 py-2 border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-ink-700 mb-1">
                  Flat or House Name <span className="text-damage">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-ink-700 mb-1">
                  Address <span className="text-damage">*</span>
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-ink-700 mb-1">
                    Contract Start Date <span className="text-damage">*</span>
                  </label>
                  <input
                    type="date"
                    value={editTenancyStart}
                    onChange={(e) => setEditTenancyStart(e.target.value)}
                    className="w-full px-3 py-2 border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent font-mono"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-ink-700 mb-1">
                    Contract Valid Until <span className="text-damage">*</span>
                  </label>
                  <input
                    type="date"
                    value={editTenancyEnd}
                    onChange={(e) => setEditTenancyEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-ink-700 mb-1">Lease Notes</label>
                <textarea
                  value={editLeaseNotes}
                  onChange={(e) => setEditLeaseNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={editSubmitting}
                  className="px-4 py-2 border border-ink-200 hover:border-ink-400 bg-surface text-ink-700 font-semibold uppercase text-xs tracking-wider transition-colors btn-motion lit"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold uppercase text-xs tracking-wider transition-colors disabled:opacity-50 btn-motion lit-dark"
                >
                  {editSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Property Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-ink-200 max-w-md w-full p-6 text-xs">
            <h2 className="text-base font-bold text-ink-900 mb-2">
              Confirm Record Deletion
            </h2>
            <p className="text-ink-600 leading-relaxed mb-4">
              Permanently delete <strong>{property?.name}</strong>?
              This will remove all move-in and move-out photos as well as private contract documents from storage and destroy the entire inspection dossier.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-ink-100">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 border border-ink-200 hover:border-ink-400 bg-surface text-ink-700 font-semibold uppercase text-xs tracking-wider transition-colors btn-motion lit"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProperty}
                disabled={deleting}
                className="px-4 py-2 bg-damage hover:bg-damage text-white font-semibold uppercase text-xs tracking-wider transition-colors disabled:opacity-50 btn-motion lit"
              >
                {deleting ? "Deleting Record..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlink Confirmation Modal */}
      {showUnlinkModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface border border-ink-200 max-w-md w-full p-6 text-xs">
            <h2 className="text-base font-bold text-ink-900 mb-2">
              Unlink Property from Owner?
            </h2>
            <p className="text-ink-600 leading-relaxed mb-4">
              Are you sure you want to disconnect this record from <strong>{tenancyLink?.name}</strong>? The owner will no longer see this tenancy link or have access to any shared reports.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-ink-100">
              <button
                type="button"
                onClick={() => setShowUnlinkModal(false)}
                disabled={unlinking}
                className="px-4 py-2 border border-ink-200 hover:border-ink-400 bg-surface text-ink-700 font-semibold uppercase text-xs tracking-wider transition-colors btn-motion lit"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnlink}
                disabled={unlinking}
                className="px-4 py-2 bg-damage hover:bg-damage text-white font-semibold uppercase text-xs tracking-wider transition-colors disabled:opacity-50 btn-motion lit"
              >
                {unlinking ? "Unlinking..." : "Unlink Property"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
