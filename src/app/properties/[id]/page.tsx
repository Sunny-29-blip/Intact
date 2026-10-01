"use client";

import { useEffect, useState, use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { api, ApiError } from "@/lib/api";
import { uploadAndRegisterPhoto } from "@/lib/client-photo";
import { updatePropertySchema, type UpdatePropertyInput } from "@/lib/validation";
import type { PropertyDetail, PhotoWithUrl } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PropertyDetailPage({ params }: PageProps) {
  const { id: propertyId } = use(params);
  const router = useRouter();

  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Edit property state
  const [showEditModal, setShowEditModal] = useState(false);
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

  const fetchProperty = async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
      const data = await api.getProperty(propertyId);
      setProperty(data);

      // Populate edit fields
      setEditName(data.name);
      setEditAddress(data.address || "");
      setEditTenancyStart(data.tenancy_start);
      setEditTenancyEnd(data.tenancy_end || "");
      setEditLeaseNotes(data.lease_notes || "");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load property details.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperty();
  }, [propertyId]);

  // Derived lists of photos
  const moveInPhotos = useMemo(
    () => property?.inspections.move_in?.photos || [],
    [property]
  );
  const moveOutPhotos = useMemo(
    () => property?.inspections.move_out?.photos || [],
    [property]
  );

  // Available unique areas from move-in photos for move-out selection
  const availableMoveInAreas = useMemo(() => {
    const set = new Set<string>();
    moveInPhotos.forEach((p) => set.add(p.area));
    return Array.from(set).sort();
  }, [moveInPhotos]);

  // Combined areas for side-by-side comparison pairing
  const pairedAreas = useMemo(() => {
    const map = new Map<
      string,
      { area: string; moveIn: PhotoWithUrl[]; moveOut: PhotoWithUrl[] }
    >();

    moveInPhotos.forEach((p) => {
      const entry = map.get(p.area) || { area: p.area, moveIn: [], moveOut: [] };
      entry.moveIn.push(p);
      map.set(p.area, entry);
    });

    moveOutPhotos.forEach((p) => {
      const entry = map.get(p.area) || { area: p.area, moveIn: [], moveOut: [] };
      entry.moveOut.push(p);
      map.set(p.area, entry);
    });

    return Array.from(map.values());
  }, [moveInPhotos, moveOutPhotos]);

  // Handle Edit Property Submit
  const handleEditProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    const payload: UpdatePropertyInput = {
      name: editName.trim(),
      address: editAddress.trim() || null,
      tenancy_start: editTenancyStart,
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
      await fetchProperty();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Failed to update property.");
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle Delete Property
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

  // Handle Move-In Photo Upload
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

      // Clear form
      setMoveInArea("");
      setMoveInFile(null);
      setMoveInStatusText(null);
      await fetchProperty();
    } catch (err) {
      setMoveInError(err instanceof Error ? err.message : "Failed to upload photo.");
    } finally {
      setMoveInUploading(false);
      setMoveInStatusText(null);
    }
  };

  // Handle Move-Out Photo Upload
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

      // Clear form
      setMoveOutArea("");
      setMoveOutFile(null);
      setMoveOutStatusText(null);
      await fetchProperty();
    } catch (err) {
      setMoveOutError(err instanceof Error ? err.message : "Failed to upload photo.");
    } finally {
      setMoveOutUploading(false);
      setMoveOutStatusText(null);
    }
  };

  // Handle Photo Deletion
  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm("Are you sure you want to remove this inspection photo?")) {
      return;
    }

    setDeletingPhotoId(photoId);
    try {
      await api.deletePhoto(photoId);
      await fetchProperty();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete photo");
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const formatSha = (sha: string) => {
    if (!sha || sha.length < 12) return sha;
    return `${sha.slice(0, 6)}...${sha.slice(-6)}`;
  };

  const formatDate = (iso: string) => {
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

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center space-x-2 text-xs text-ink-500 mb-4">
        <Link href="/properties" className="hover:text-ink-900 underline">
          Properties
        </Link>
        <span>/</span>
        <span className="text-ink-900 font-medium truncate max-w-xs">
          {property?.name || "Inspection Record"}
        </span>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-white border border-ink-200 rounded p-8 animate-pulse space-y-4">
          <div className="h-6 bg-paper-200 rounded w-1/3"></div>
          <div className="h-4 bg-paper-100 rounded w-1/2"></div>
          <div className="h-32 bg-paper-50 rounded"></div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-damage-bg border border-damage-border rounded text-xs text-damage mb-6 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchProperty}
            className="underline font-medium hover:text-damage"
          >
            Retry
          </button>
        </div>
      )}

      {/* Property Details Header */}
      {!loading && property && (
        <>
          <div className="bg-white border border-ink-200 rounded p-6 sm:p-8 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-ink-100 pb-5">
              <div>
                <div className="text-xs font-mono uppercase text-ink-500 tracking-wider mb-1">
                  Tenancy Condition Dossier
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-ink-900">
                  {property.name}
                </h1>
                {property.address && (
                  <p className="text-sm text-ink-600 mt-1">{property.address}</p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="px-3 py-1.5 text-xs font-medium text-ink-700 hover:text-ink-900 border border-ink-200 hover:border-ink-400 bg-white rounded transition-colors"
                >
                  Edit Details
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-3 py-1.5 text-xs font-medium text-damage hover:bg-damage-bg border border-damage-border rounded transition-colors"
                >
                  Delete Record
                </button>
              </div>
            </div>

            {/* Tenancy & Inspection Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 text-xs">
              <div>
                <span className="block font-mono text-ink-500 uppercase">Tenancy Period</span>
                <span className="font-semibold text-ink-900 mt-0.5 block">
                  {property.tenancy_start}
                  {property.tenancy_end ? ` → ${property.tenancy_end}` : " (Current)"}
                </span>
              </div>
              <div>
                <span className="block font-mono text-ink-500 uppercase">Move-in Baseline</span>
                <span className="font-semibold text-ink-900 mt-0.5 block">
                  {moveInPhotos.length} photo{moveInPhotos.length === 1 ? "" : "s"} archived
                </span>
              </div>
              <div>
                <span className="block font-mono text-ink-500 uppercase">Move-out Verification</span>
                <span className="font-semibold text-ink-900 mt-0.5 block">
                  {moveOutPhotos.length} photo{moveOutPhotos.length === 1 ? "" : "s"} paired
                </span>
              </div>
            </div>

            {property.lease_notes && (
              <div className="mt-4 pt-4 border-t border-ink-100 text-xs text-ink-700 bg-paper-50 p-3 rounded border border-ink-100">
                <span className="font-semibold font-mono uppercase text-ink-500 mr-2">
                  Lease Notes:
                </span>
                {property.lease_notes}
              </div>
            )}
          </div>

          {/* Section 1: Move-In Inspection (Baseline) */}
          <section className="bg-white border border-ink-200 rounded p-6 sm:p-8 mb-8">
            <div className="border-b border-ink-100 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-xs font-mono uppercase text-ink-500">
                  Stage 1: Arrival Condition
                </div>
                <h2 className="text-xl font-bold text-ink-900">
                  Move-In Baseline Photos
                </h2>
              </div>
              <span className="text-xs font-mono text-ink-500">
                {moveInPhotos.length} area photos
              </span>
            </div>

            {/* Move-in upload box */}
            <div className="bg-paper-50 border border-ink-200 rounded p-4 sm:p-5 mb-6 text-xs">
              <h3 className="font-semibold text-ink-900 mb-1">
                Archive a Move-In Area Photo
              </h3>
              <p className="text-ink-600 mb-4">
                Enter the specific room or area label and select a high-resolution photo.
              </p>

              {moveInError && (
                <div className="mb-4 p-3 bg-damage-bg border border-damage-border rounded text-damage">
                  {moveInError}
                </div>
              )}

              <form onSubmit={handleMoveInUpload} className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5">
                  <label className="block font-medium text-ink-700 mb-1">
                    Area Description <span className="text-damage">*</span>
                  </label>
                  <input
                    type="text"
                    value={moveInArea}
                    onChange={(e) => setMoveInArea(e.target.value)}
                    placeholder="e.g. Master Bedroom — East Wall"
                    disabled={moveInUploading}
                    className="w-full px-3 py-2 border border-ink-200 rounded bg-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block font-medium text-ink-700 mb-1">
                    Photo File <span className="text-damage">*</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setMoveInFile(e.target.files?.[0] || null)}
                    disabled={moveInUploading}
                    className="w-full text-xs text-ink-700 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border file:border-ink-200 file:bg-white file:text-xs file:font-medium hover:file:bg-paper-100"
                  />
                </div>

                <div className="md:col-span-3 flex items-end">
                  <button
                    type="submit"
                    disabled={moveInUploading || !moveInFile}
                    className="w-full py-2 px-3 bg-accent hover:bg-accent-hover text-white rounded font-medium transition-colors disabled:opacity-50"
                  >
                    {moveInUploading ? (moveInStatusText || "Uploading...") : "+ Add Move-In Photo"}
                  </button>
                </div>
              </form>
            </div>

            {/* Move-in photo gallery */}
            {moveInPhotos.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-ink-200 rounded text-xs text-ink-500">
                No move-in photos archived yet. Photograph your property areas above to establish baseline conditions.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {moveInPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="border border-ink-200 rounded overflow-hidden bg-paper-50 flex flex-col"
                  >
                    <div className="relative aspect-[4/3] bg-paper-200 flex items-center justify-center">
                      {photo.signed_url ? (
                        <img
                          src={photo.signed_url}
                          alt={photo.area}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xs text-ink-500 font-mono">Image loading...</span>
                      )}
                    </div>
                    <div className="p-3 flex-1 flex flex-col justify-between text-xs">
                      <div>
                        <div className="font-semibold text-ink-900">{photo.area}</div>
                        <div className="font-mono text-[10px] text-ink-500 mt-1">
                          Recorded: {formatDate(photo.created_at)}
                        </div>
                        <div className="font-mono text-[10px] text-ink-500 mt-0.5 truncate" title={photo.sha256}>
                          SHA: {formatSha(photo.sha256)}
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-ink-100 flex justify-end">
                        <button
                          onClick={() => handleDeletePhoto(photo.id)}
                          disabled={deletingPhotoId === photo.id}
                          className="text-[11px] text-damage hover:underline"
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

          {/* Section 2: Move-Out Inspection & Side-by-Side Comparison Pairing */}
          <section className="bg-white border border-ink-200 rounded p-6 sm:p-8">
            <div className="border-b border-ink-100 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-xs font-mono uppercase text-ink-500">
                  Stage 2: Departure Verification
                </div>
                <h2 className="text-xl font-bold text-ink-900">
                  Move-Out Pairing & Comparison
                </h2>
              </div>
              <span className="text-xs font-mono text-ink-500">
                {moveOutPhotos.length} / {availableMoveInAreas.length} areas paired
              </span>
            </div>

            {/* Move-out upload box */}
            {availableMoveInAreas.length === 0 ? (
              <div className="p-4 bg-paper-100 border border-ink-200 rounded text-xs text-ink-600 mb-6">
                <strong>Move-out photos require a baseline:</strong> Please upload move-in photos in the section above first. Once baseline areas exist, you can photograph corresponding departure conditions.
              </div>
            ) : (
              <div className="bg-paper-50 border border-ink-200 rounded p-4 sm:p-5 mb-8 text-xs">
                <h3 className="font-semibold text-ink-900 mb-1">
                  Upload Matching Move-Out Photo
                </h3>
                <p className="text-ink-600 mb-4">
                  Select an area that already exists in your move-in baseline to form an exact before-and-after pair.
                </p>

                {moveOutError && (
                  <div className="mb-4 p-3 bg-damage-bg border border-damage-border rounded text-damage">
                    {moveOutError}
                  </div>
                )}

                <form onSubmit={handleMoveOutUpload} className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-5">
                    <label className="block font-medium text-ink-700 mb-1">
                      Target Area <span className="text-damage">*</span>
                    </label>
                    <select
                      value={moveOutArea}
                      onChange={(e) => setMoveOutArea(e.target.value)}
                      disabled={moveOutUploading}
                      className="w-full px-3 py-2 border border-ink-200 rounded bg-white focus:outline-none focus:border-accent"
                    >
                      <option value="">-- Choose Move-In Area --</option>
                      {availableMoveInAreas.map((area) => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-4">
                    <label className="block font-medium text-ink-700 mb-1">
                      Departure Photo <span className="text-damage">*</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setMoveOutFile(e.target.files?.[0] || null)}
                      disabled={moveOutUploading}
                      className="w-full text-xs text-ink-700 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border file:border-ink-200 file:bg-white file:text-xs file:font-medium hover:file:bg-paper-100"
                    />
                  </div>

                  <div className="md:col-span-3 flex items-end">
                    <button
                      type="submit"
                      disabled={moveOutUploading || !moveOutFile || !moveOutArea}
                      className="w-full py-2 px-3 bg-accent hover:bg-accent-hover text-white rounded font-medium transition-colors disabled:opacity-50"
                    >
                      {moveOutUploading ? (moveOutStatusText || "Uploading...") : "+ Pair Move-Out Photo"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Side-by-side Pairs list */}
            {pairedAreas.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-ink-200 rounded text-xs text-ink-500">
                No inspection pairs established yet.
              </div>
            ) : (
              <div className="space-y-6">
                {pairedAreas.map((group) => {
                  const moveInPhoto = group.moveIn[0];
                  const moveOutPhoto = group.moveOut[0];
                  const isPaired = Boolean(moveInPhoto && moveOutPhoto);

                  return (
                    <div
                      key={group.area}
                      className="border border-ink-200 rounded bg-paper-50 p-4 sm:p-5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-ink-200 pb-3 mb-4 gap-2">
                        <div>
                          <span className="text-[10px] font-mono uppercase text-ink-500">
                            Condition Pair
                          </span>
                          <h3 className="text-base font-bold text-ink-900">
                            {group.area}
                          </h3>
                        </div>

                        {/* Placeholder button per paired area */}
                        {isPaired ? (
                          <div className="flex items-center space-x-2">
                            <span className="text-[11px] font-mono px-2 py-0.5 bg-accepted-bg border border-accepted-border text-accepted rounded">
                              ✓ Paired
                            </span>
                            <button
                              disabled
                              title="Gemini visual difference comparison will be enabled in the next phase"
                              className="px-3 py-1.5 text-xs font-mono font-medium border border-ink-300 text-ink-500 bg-paper-100 rounded cursor-not-allowed"
                            >
                              Compare (AI Analysis)
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-mono px-2 py-0.5 bg-wear-bg border border-wear-border text-wear rounded">
                            Awaiting Move-Out Photo
                          </span>
                        )}
                      </div>

                      {/* Side-by-side photo grid (stacks on mobile) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Move-In Photo (Left) */}
                        <div className="border border-ink-200 rounded bg-white p-3">
                          <div className="flex items-center justify-between text-xs font-semibold text-ink-700 mb-2">
                            <span>MOVE-IN BASELINE</span>
                            {moveInPhoto && (
                              <button
                                onClick={() => handleDeletePhoto(moveInPhoto.id)}
                                disabled={deletingPhotoId === moveInPhoto.id}
                                className="text-[10px] text-damage hover:underline"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                          {moveInPhoto ? (
                            <div>
                              <div className="aspect-[4/3] bg-paper-100 rounded overflow-hidden mb-2">
                                <img
                                  src={moveInPhoto.signed_url}
                                  alt={`Move-in ${group.area}`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                              <div className="text-[11px] font-mono text-ink-600 flex justify-between">
                                <span>{formatDate(moveInPhoto.created_at)}</span>
                                <span title={moveInPhoto.sha256}>
                                  SHA: {formatSha(moveInPhoto.sha256)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="aspect-[4/3] border border-dashed border-ink-200 rounded flex items-center justify-center text-xs text-ink-400">
                              Missing baseline photo
                            </div>
                          )}
                        </div>

                        {/* Move-Out Photo (Right) */}
                        <div className="border border-ink-200 rounded bg-white p-3">
                          <div className="flex items-center justify-between text-xs font-semibold text-ink-700 mb-2">
                            <span>MOVE-OUT DEPARTURE</span>
                            {moveOutPhoto && (
                              <button
                                onClick={() => handleDeletePhoto(moveOutPhoto.id)}
                                disabled={deletingPhotoId === moveOutPhoto.id}
                                className="text-[10px] text-damage hover:underline"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                          {moveOutPhoto ? (
                            <div>
                              <div className="aspect-[4/3] bg-paper-100 rounded overflow-hidden mb-2">
                                <img
                                  src={moveOutPhoto.signed_url}
                                  alt={`Move-out ${group.area}`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                              <div className="text-[11px] font-mono text-ink-600 flex justify-between">
                                <span>{formatDate(moveOutPhoto.created_at)}</span>
                                <span title={moveOutPhoto.sha256}>
                                  SHA: {formatSha(moveOutPhoto.sha256)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="aspect-[4/3] border border-dashed border-ink-200 rounded flex items-center justify-center text-xs text-ink-400">
                              Departure photo not yet uploaded
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* Edit Property Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-ink-200 rounded max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-ink-100 pb-3 mb-5 flex items-center justify-between">
              <div>
                <div className="text-xs font-mono uppercase text-ink-500">Edit Record</div>
                <h2 className="text-lg font-bold text-ink-900">Update Property Details</h2>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-ink-500 hover:text-ink-900"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 bg-damage-bg border border-damage-border rounded text-xs text-damage">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditProperty} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-ink-700 mb-1">
                  Property Name <span className="text-damage">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-ink-200 rounded bg-paper-50 focus:bg-white focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-medium text-ink-700 mb-1">Address</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-ink-200 rounded bg-paper-50 focus:bg-white focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink-700 mb-1">
                    Tenancy Start <span className="text-damage">*</span>
                  </label>
                  <input
                    type="date"
                    value={editTenancyStart}
                    onChange={(e) => setEditTenancyStart(e.target.value)}
                    className="w-full px-3 py-2 border border-ink-200 rounded bg-paper-50 focus:bg-white focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block font-medium text-ink-700 mb-1">Tenancy End</label>
                  <input
                    type="date"
                    value={editTenancyEnd}
                    onChange={(e) => setEditTenancyEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-ink-200 rounded bg-paper-50 focus:bg-white focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink-700 mb-1">Lease Notes</label>
                <textarea
                  value={editLeaseNotes}
                  onChange={(e) => setEditLeaseNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-ink-200 rounded bg-paper-50 focus:bg-white focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={editSubmitting}
                  className="px-4 py-2 border border-ink-200 hover:border-ink-400 bg-white text-ink-700 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded font-medium transition-colors disabled:opacity-50"
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
          <div className="bg-white border border-ink-200 rounded max-w-md w-full p-6 text-xs">
            <h2 className="text-base font-bold text-ink-900 mb-2">
              Confirm Record Deletion
            </h2>
            <p className="text-ink-600 leading-relaxed mb-4">
              Are you sure you want to permanently delete <strong>{property?.name}</strong>?
              This will remove all move-in and move-out photos from storage and destroy the entire inspection dossier.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-ink-100">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 border border-ink-200 hover:border-ink-400 bg-white text-ink-700 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProperty}
                disabled={deleting}
                className="px-4 py-2 bg-damage hover:bg-damage text-white rounded font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting Record..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
