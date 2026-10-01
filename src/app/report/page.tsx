"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { api, ApiError } from "@/lib/api";
import { uploadAndRegisterPhoto } from "@/lib/client-photo";
import type {
  PropertyListItem,
  PhotoWithUrl,
  ComparisonWithFindings,
  Finding,
  IssueType,
} from "@/types/database";

interface CalculatedMarker {
  id: string;
  index: number;
  finding: Finding;
  hasBox: boolean;
  left: number;
  top: number;
}

export default function ReportDashboardPage() {
  const router = useRouter();

  // Authentication & Properties state
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [areaName, setAreaName] = useState("");

  // Move-in / Move-out Photo state
  const [moveInFile, setMoveInFile] = useState<File | null>(null);
  const [moveInPreview, setMoveInPreview] = useState<string | null>(null);
  const [moveInPhoto, setMoveInPhoto] = useState<PhotoWithUrl | null>(null);
  const [moveInUploading, setMoveInUploading] = useState(false);
  const [moveInStatus, setMoveInStatus] = useState<string | null>(null);

  const [moveOutFile, setMoveOutFile] = useState<File | null>(null);
  const [moveOutPreview, setMoveOutPreview] = useState<string | null>(null);
  const [moveOutPhoto, setMoveOutPhoto] = useState<PhotoWithUrl | null>(null);
  const [moveOutUploading, setMoveOutUploading] = useState(false);
  const [moveOutStatus, setMoveOutStatus] = useState<string | null>(null);

  // Comparison execution state
  const [comparing, setComparing] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [comparisonErrorRef, setComparisonErrorRef] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonWithFindings | null>(null);

  // Interactive Finding Card / Marker linking
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [hoveredFindingId, setHoveredFindingId] = useState<string | null>(null);

  // Reject note editor state per finding
  const [editingRejectId, setEditingRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [updatingDecisionId, setUpdatingDecisionId] = useState<string | null>(null);

  // Recent comparisons / previous checks state
  const [recentComparisons, setRecentComparisons] = useState<ComparisonWithFindings[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // Live announcer for accessibility
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  // Refs for file inputs
  const moveInInputRef = useRef<HTMLInputElement | null>(null);
  const moveOutInputRef = useRef<HTMLInputElement | null>(null);

  // Drag over states
  const [isMoveInDragging, setIsMoveInDragging] = useState(false);
  const [isMoveOutDragging, setIsMoveOutDragging] = useState(false);

  // Initial load
  const loadInitialData = async () => {
    setLoadingInitial(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      // Fetch user's properties (including quick checks)
      const res = await fetch("/api/properties?includeQuickCheck=true");
      let propList: PropertyListItem[] = [];
      if (res.ok) {
        const body = await res.json();
        propList = body.data || [];
      }

      // If user has no properties at all, create a private "Quick checks" workspace
      if (propList.length === 0) {
        const today = new Date().toISOString().split("T")[0];
        const newWorkspace = await api.createProperty({
          name: "Quick checks",
          address: "Standalone comparison workspace",
          tenancy_start: today,
          is_quick_check: true,
        });

        const workspaceItem: PropertyListItem = {
          ...newWorkspace,
          move_in_count: 0,
          move_out_count: 0,
        };
        propList = [workspaceItem];
      }

      setProperties(propList);
      setSelectedPropertyId(propList[0].id);

      // Fetch previous checks
      await fetchRecentChecks();
    } catch (err) {
      console.error("[ReportDashboard] Init error:", err);
    } finally {
      setLoadingInitial(false);
    }
  };

  const fetchRecentChecks = async () => {
    setLoadingRecent(true);
    try {
      const res = await fetch("/api/comparisons");
      if (res.ok) {
        const body = await res.json();
        setRecentComparisons(body.data || []);
      }
    } catch (err) {
      console.error("[ReportDashboard] Recent checks error:", err);
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const selectedProperty = useMemo(() => {
    return properties.find((p) => p.id === selectedPropertyId) || null;
  }, [properties, selectedPropertyId]);

  // Handle move-in photo file selection
  const handleMoveInFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setComparisonError("Please select a valid image file (JPEG, PNG, or WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setComparisonError("Move-in photo exceeds 10 MB limit.");
      return;
    }

    setMoveInFile(file);
    setMoveInPreview(URL.createObjectURL(file));
    setMoveInPhoto(null);
    setComparisonError(null);
  };

  // Handle move-out photo file selection
  const handleMoveOutFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setComparisonError("Please select a valid image file (JPEG, PNG, or WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setComparisonError("Move-out photo exceeds 10 MB limit.");
      return;
    }

    setMoveOutFile(file);
    setMoveOutPreview(URL.createObjectURL(file));
    setMoveOutPhoto(null);
    setComparisonError(null);
  };

  // Run the two-photo comparison
  const handleRunComparison = async () => {
    if (!userId || !selectedPropertyId) {
      setComparisonError("Please select a property or workspace.");
      return;
    }

    const cleanArea = areaName.trim();
    if (!cleanArea) {
      setComparisonError("Please enter an area name (e.g. Bedroom, north wall).");
      return;
    }

    if (!moveInFile && !moveInPhoto) {
      setComparisonError("Please add a move-in photo.");
      return;
    }

    if (!moveOutFile && !moveOutPhoto) {
      setComparisonError("Please add a move-out photo.");
      return;
    }

    setComparing(true);
    setComparisonError(null);
    setLiveAnnouncement("Comparing your photos. This usually takes 10 to 20 seconds.");

    try {
      // 1. Ensure inspections exist for the property
      const detail = await api.getProperty(selectedPropertyId);
      let moveInInspId = detail.inspections.move_in?.id;
      let moveOutInspId = detail.inspections.move_out?.id;

      if (!moveInInspId || !moveOutInspId) {
        const refreshed = await api.getProperty(selectedPropertyId);
        moveInInspId = refreshed.inspections.move_in?.id;
        moveOutInspId = refreshed.inspections.move_out?.id;
      }

      if (!moveInInspId || !moveOutInspId) {
        throw new Error("Inspection sessions could not be initialized.");
      }

      // 2. Upload move-in photo if not already uploaded
      let currentMoveInPhoto = moveInPhoto;
      if (moveInFile && !currentMoveInPhoto) {
        setMoveInUploading(true);
        setMoveInStatus("Uploading move-in photo...");
        currentMoveInPhoto = await uploadAndRegisterPhoto({
          userId,
          propertyId: selectedPropertyId,
          inspectionId: moveInInspId,
          inspectionKind: "move_in",
          area: cleanArea,
          file: moveInFile,
          onProgress: (st) => setMoveInStatus(st),
        });
        setMoveInPhoto(currentMoveInPhoto);
        setMoveInUploading(false);
        setMoveInStatus(null);
      }

      // 3. Upload move-out photo if not already uploaded
      let currentMoveOutPhoto = moveOutPhoto;
      if (moveOutFile && !currentMoveOutPhoto) {
        setMoveOutUploading(true);
        setMoveOutStatus("Uploading move-out photo...");
        currentMoveOutPhoto = await uploadAndRegisterPhoto({
          userId,
          propertyId: selectedPropertyId,
          inspectionId: moveOutInspId,
          inspectionKind: "move_out",
          area: cleanArea,
          file: moveOutFile,
          onProgress: (st) => setMoveOutStatus(st),
        });
        setMoveOutPhoto(currentMoveOutPhoto);
        setMoveOutUploading(false);
        setMoveOutStatus(null);
      }

      // 4. Trigger the comparison
      const result = await api.triggerComparison(selectedPropertyId, cleanArea);
      setComparisonResult(result);
      setLiveAnnouncement(
        result.findings.length === 0
          ? "Comparison complete: No differences found."
          : `Comparison complete: ${result.findings.length} difference${
              result.findings.length === 1 ? "" : "s"
            } found.`
      );

      // Refresh recent checks list
      fetchRecentChecks();
    } catch (err) {
      console.error("[ReportDashboard] Run comparison error:", err);
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Comparison could not be completed. Please try again.";
      setComparisonError(message);
      setComparisonErrorRef(err instanceof ApiError ? err.ref || null : null);
      setLiveAnnouncement(`Error: ${message}`);
    } finally {
      setComparing(false);
      setMoveInUploading(false);
      setMoveOutUploading(false);
      setMoveInStatus(null);
      setMoveOutStatus(null);
    }
  };

  // Handle Accept / Reject / Clear decision
  const handleDecision = async (
    finding: Finding,
    decision: "accepted" | "disputed" | "pending",
    note?: string
  ) => {
    setUpdatingDecisionId(finding.id);
    try {
      const updatedFinding = await api.updateFindingDecision(finding.id, {
        decision,
        note: note !== undefined ? note : finding.decision_note,
      });

      if (comparisonResult) {
        const updatedList = comparisonResult.findings.map((f) =>
          f.id === finding.id ? updatedFinding : f
        );
        setComparisonResult({
          ...comparisonResult,
          findings: updatedList,
        });
      }

      setEditingRejectId(null);
      setRejectNote("");
      setLiveAnnouncement(`Finding decision set to ${decision}.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save decision");
    } finally {
      setUpdatingDecisionId(null);
    }
  };

  // Load a previous check into the viewer
  const handleSelectPreviousCheck = (check: ComparisonWithFindings) => {
    setComparisonResult(check);
    setSelectedPropertyId(check.property_id);
    setAreaName(check.area);

    if (check.move_in_photo?.signed_url) {
      setMoveInPreview(check.move_in_photo.signed_url);
      setMoveInPhoto(check.move_in_photo);
      setMoveInFile(null);
    }

    if (check.move_out_photo?.signed_url) {
      setMoveOutPreview(check.move_out_photo.signed_url);
      setMoveOutPhoto(check.move_out_photo);
      setMoveOutFile(null);
    }

    setComparisonError(null);
    window.scrollTo({ top: 380, behavior: "smooth" });
  };

  // Numbered markers calculation
  const markers = useMemo<CalculatedMarker[]>(() => {
    const placed: CalculatedMarker[] = [];
    const findings = comparisonResult?.findings || [];

    findings.forEach((f, idx) => {
      if (
        f.box_ymin === null ||
        f.box_xmin === null ||
        f.box_ymax === null ||
        f.box_xmax === null
      ) {
        placed.push({
          id: f.id,
          index: idx,
          finding: f,
          hasBox: false,
          left: 0,
          top: 0,
        });
        return;
      }

      const rawLeft = (f.box_xmin + f.box_xmax) / 2 / 10;
      const rawTop = (f.box_ymin + f.box_ymax) / 2 / 10;

      let left = Math.max(4, Math.min(96, rawLeft));
      let top = Math.max(4, Math.min(96, rawTop));

      // Nudge if too close to an existing marker
      for (const prev of placed) {
        if (
          prev.hasBox &&
          Math.abs(prev.left - left) < 5 &&
          Math.abs(prev.top - top) < 6
        ) {
          top = Math.min(96, top + 6.5);
        }
      }

      placed.push({
        id: f.id,
        index: idx,
        finding: f,
        hasBox: true,
        left,
        top,
      });
    });

    return placed;
  }, [comparisonResult]);

  // Derived condition label & color
  const getConditionLabel = (f: Finding) => {
    if (f.classification === "wear") return "Normal wear";
    if (f.classification === "unclear") return "Unclear";
    if (f.classification === "damage") {
      if (f.severity === "major") return "Severe damage";
      if (f.severity === "moderate") return "Moderate damage";
      return "Minor damage";
    }
    return "Unclear";
  };

  const getConditionColor = (f: Finding) => {
    if (f.classification === "damage") return "text-damage font-semibold";
    if (f.classification === "wear") return "text-wear font-semibold";
    return "text-unclear font-semibold";
  };

  const getConfidenceWord = (confidence: number) => {
    if (confidence >= 0.8) return "Confidence: High";
    if (confidence >= 0.5) return "Confidence: Medium";
    return "Confidence: Low";
  };

  const formatIssueTag = (type?: IssueType | string | null) => {
    if (!type) return "Other";
    const map: Record<string, string> = {
      scratch: "Scratch",
      crack: "Crack",
      stain: "Stain",
      hole: "Hole",
      missing_item: "Missing item",
      mark: "Mark",
      other: "Other",
    };
    return map[type] || "Other";
  };

  // Findings summary text
  const summaryLine = useMemo(() => {
    if (!comparisonResult) return "";
    const findings = comparisonResult.findings || [];
    if (findings.length === 0) return "No differences found.";

    const damageCount = findings.filter((f) => f.classification === "damage").length;
    const wearCount = findings.filter((f) => f.classification === "wear").length;
    const unclearCount = findings.filter((f) => f.classification === "unclear").length;

    const parts: string[] = [];
    if (damageCount > 0) parts.push(`${damageCount} damage`);
    if (wearCount > 0) parts.push(`${wearCount} normal wear`);
    if (unclearCount > 0) parts.push(`${unclearCount} unclear`);

    const countStr = `${findings.length} difference${findings.length === 1 ? "" : "s"} found`;
    if (parts.length === 0) return countStr;
    return `${countStr}: ${parts.join(", ")}.`;
  }, [comparisonResult]);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Live Region for Screen Readers */}
      <div className="sr-only" role="status" aria-live="polite">
        {liveAnnouncement}
      </div>

      {/* Header */}
      <div className="border-b border-ink-200 pb-6 mb-8">
        <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider mb-1">
          ANALYSIS DASHBOARD
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-900">
          Report
        </h1>
        <p className="text-xs sm:text-sm text-ink-600 mt-1 font-sans">
          Add a move-in photo and a move-out photo of the same place. Intact lists what looks different.
        </p>
      </div>

      {/* Loading state */}
      {loadingInitial ? (
        <div className="border border-ink-200 bg-surface p-8 animate-pulse space-y-4">
          <div className="h-4 bg-page w-1/4"></div>
          <div className="h-8 bg-page w-1/2"></div>
          <div className="h-32 bg-page"></div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Section A: "Where is this?" */}
          <div className="bg-surface border border-ink-200 p-6 sm:p-7">
            <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider mb-3 font-semibold">
              LOCATION & CONTEXT
            </div>
            <h2 className="text-base font-bold text-ink-900 mb-4">Where is this?</h2>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 text-xs">
              <div className="sm:col-span-6">
                <label className="block font-mono text-[10px] uppercase text-ink-700 mb-1.5 font-medium">
                  Property or Workspace <span className="text-damage">*</span>
                </label>
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  disabled={comparing}
                  className="w-full px-3 py-2.5 border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent text-xs font-sans"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.is_quick_check ? "(Quick check)" : p.address ? `— ${p.address}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-6">
                <label className="block font-mono text-[10px] uppercase text-ink-700 mb-1.5 font-medium">
                  Area Name <span className="text-damage">*</span>
                </label>
                <input
                  type="text"
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  placeholder="e.g. Bedroom, north wall"
                  disabled={comparing}
                  className="w-full px-3 py-2.5 border border-ink-200 bg-page focus:bg-surface focus:outline-none focus:border-accent text-xs font-sans"
                />
              </div>
            </div>
          </div>

          {/* Section B: Two Large Dropzones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Move-In Photo Dropzone */}
            <div className="bg-surface border border-ink-200 p-5 sm:p-6 flex flex-col">
              <div className="flex items-center justify-between border-b border-ink-200 pb-3 mb-4">
                <div>
                  <div className="text-[10px] font-mono uppercase text-ink-500 font-semibold">
                    BASELINE
                  </div>
                  <h3 className="text-sm font-bold text-ink-900">Move-in photo</h3>
                </div>
                {moveInPreview && (
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => moveInInputRef.current?.click()}
                      disabled={comparing || moveInUploading}
                      className="text-[11px] font-mono text-ink-700 hover:text-ink-900 underline"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMoveInFile(null);
                        setMoveInPreview(null);
                        setMoveInPhoto(null);
                      }}
                      disabled={comparing || moveInUploading}
                      className="text-[11px] font-mono text-damage hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {moveInPreview ? (
                <div className="aspect-[4/3] bg-ink-100 border border-ink-200 relative overflow-hidden flex items-center justify-center">
                  <img
                    src={moveInPreview}
                    alt="Move-in photo preview"
                    className="w-full h-full object-cover"
                  />
                  {moveInUploading && (
                    <div className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center p-4 text-center font-mono text-xs">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin mb-2"></div>
                      <span>{moveInStatus || "Uploading move-in photo..."}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      moveInInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsMoveInDragging(true);
                  }}
                  onDragLeave={() => setIsMoveInDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsMoveInDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleMoveInFile(file);
                  }}
                  onClick={() => moveInInputRef.current?.click()}
                  className={`aspect-[4/3] border-2 border-dashed flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-accent ${
                    isMoveInDragging
                      ? "border-accent bg-accent-tint"
                      : "border-ink-300 hover:border-accent bg-page"
                  }`}
                >
                  <div className="w-10 h-10 border border-ink-200 bg-surface text-ink-500 flex items-center justify-center font-mono text-lg mb-2">
                    +
                  </div>
                  <span className="font-mono text-xs font-bold text-ink-900 uppercase tracking-wider">
                    Select move-in photo
                  </span>
                  <span className="text-[11px] text-ink-500 mt-1 font-sans">
                    Drag and drop or click to choose
                  </span>
                  <span className="text-[10px] font-mono text-ink-400 mt-2">
                    JPEG, PNG, WebP up to 10 MB
                  </span>
                </div>
              )}

              <input
                ref={moveInInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleMoveInFile(file);
                }}
              />
            </div>

            {/* Move-Out Photo Dropzone */}
            <div className="bg-surface border border-ink-200 p-5 sm:p-6 flex flex-col">
              <div className="flex items-center justify-between border-b border-ink-200 pb-3 mb-4">
                <div>
                  <div className="text-[10px] font-mono uppercase text-ink-500 font-semibold">
                    DEPARTURE
                  </div>
                  <h3 className="text-sm font-bold text-ink-900">Move-out photo</h3>
                </div>
                {moveOutPreview && (
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => moveOutInputRef.current?.click()}
                      disabled={comparing || moveOutUploading}
                      className="text-[11px] font-mono text-ink-700 hover:text-ink-900 underline"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMoveOutFile(null);
                        setMoveOutPreview(null);
                        setMoveOutPhoto(null);
                      }}
                      disabled={comparing || moveOutUploading}
                      className="text-[11px] font-mono text-damage hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {moveOutPreview ? (
                <div className="aspect-[4/3] bg-ink-100 border border-ink-200 relative overflow-hidden flex items-center justify-center">
                  <img
                    src={moveOutPreview}
                    alt="Move-out photo preview"
                    className="w-full h-full object-cover"
                  />
                  {moveOutUploading && (
                    <div className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center p-4 text-center font-mono text-xs">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin mb-2"></div>
                      <span>{moveOutStatus || "Uploading move-out photo..."}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      moveOutInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsMoveOutDragging(true);
                  }}
                  onDragLeave={() => setIsMoveOutDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsMoveOutDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleMoveOutFile(file);
                  }}
                  onClick={() => moveOutInputRef.current?.click()}
                  className={`aspect-[4/3] border-2 border-dashed flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-accent ${
                    isMoveOutDragging
                      ? "border-accent bg-accent-tint"
                      : "border-ink-300 hover:border-accent bg-page"
                  }`}
                >
                  <div className="w-10 h-10 border border-ink-200 bg-surface text-ink-500 flex items-center justify-center font-mono text-lg mb-2">
                    +
                  </div>
                  <span className="font-mono text-xs font-bold text-ink-900 uppercase tracking-wider">
                    Select move-out photo
                  </span>
                  <span className="text-[11px] text-ink-500 mt-1 font-sans">
                    Drag and drop or click to choose
                  </span>
                  <span className="text-[10px] font-mono text-ink-400 mt-2">
                    JPEG, PNG, WebP up to 10 MB
                  </span>
                </div>
              )}

              <input
                ref={moveOutInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleMoveOutFile(file);
                }}
              />
            </div>
          </div>

          {/* Section C: Check for Differences Button & Progress State */}
          <div className="space-y-4">
            {/* Error / Failure Banner (neutral panel) */}
            {comparisonError && (
              <div className="p-4 bg-page border border-ink-300 text-xs text-ink-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
                <div>
                  <div className="font-mono text-[10px] uppercase font-bold text-ink-600 mb-0.5">
                    Notice
                  </div>
                  <div>{comparisonError}</div>
                  {comparisonErrorRef && (
                    <div className="font-mono text-[10px] text-ink-500 mt-1">Reference: {comparisonErrorRef}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleRunComparison}
                  className="px-3 py-1.5 border border-ink-300 hover:border-ink-500 bg-surface text-ink-800 text-xs font-semibold uppercase tracking-wider font-mono transition-colors self-start sm:self-auto btn-motion lit"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Running comparison progress banner */}
            {comparing && (
              <div className="p-5 bg-page border border-ink-200 text-xs">
                <div className="flex items-center justify-between border-b border-ink-200 pb-2.5 mb-3">
                  <span className="font-mono text-[11px] uppercase font-bold text-accent tracking-wider">
                    COMPARING YOUR PHOTOS
                  </span>
                  <span className="font-mono text-[10px] text-ink-500">
                    Processing inspection pair
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-ink-700 mb-2">
                  <span className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-accent inline-block"></span>
                    <span>MOVE-IN PHOTO</span>
                  </span>
                  <span className="text-ink-400">⟷</span>
                  <span className="flex items-center space-x-2">
                    <span>MOVE-OUT PHOTO</span>
                    <span className="w-1.5 h-1.5 bg-accent inline-block"></span>
                  </span>
                </div>

                <div className="w-full bg-ink-100 h-1 relative overflow-hidden mb-3">
                  <div className="absolute inset-y-0 left-0 bg-accent w-1/3 animate-pulse"></div>
                </div>

                <p className="text-ink-600 text-xs font-sans">
                  Comparing your photos. This usually takes 10 to 20 seconds.
                </p>
              </div>
            )}

            {/* Primary Action Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRunComparison}
                disabled={
                  comparing ||
                  !areaName.trim() ||
                  (!moveInFile && !moveInPhoto) ||
                  (!moveOutFile && !moveOutPhoto)
                }
                className="w-full sm:w-auto min-h-[48px] px-8 py-3 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider font-mono transition-colors disabled:opacity-40 btn-motion lit-dark"
              >
                {comparing ? "Comparing..." : "Check for differences"}
              </button>
            </div>
          </div>

          {/* Section D: RESULTS */}
          {comparisonResult && (
            <section className="bg-surface border border-ink-200 p-6 sm:p-8 space-y-6">
              {/* Header & Summary */}
              <div className="border-b border-ink-200 pb-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <div>
                  <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                    ANALYSIS RESULTS · {comparisonResult.area}
                  </div>
                  <h2 className="text-xl font-bold text-ink-900 mt-0.5">
                    {summaryLine}
                  </h2>
                </div>
                {!selectedProperty?.is_quick_check && selectedProperty?.share_token && (
                  <Link
                    href={`/report/${selectedProperty.share_token}`}
                    target="_blank"
                    className="text-xs font-mono text-accent hover:underline font-semibold"
                  >
                    Open full property report ↗
                  </Link>
                )}
              </div>

              {/* Side-by-Side Photos with Numbered Square Markers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Move-In Reference Photo */}
                <div className="border border-ink-200 bg-page p-3 flex flex-col photo-frame lit">
                  <div className="text-xs font-mono font-semibold text-ink-700 mb-2">
                    MOVE-IN PHOTO (REFERENCE)
                  </div>
                  <div className="aspect-[4/3] bg-ink-100 border border-ink-200 relative overflow-hidden flex items-center justify-center">
                    {comparisonResult.move_in_photo?.signed_url || moveInPreview ? (
                      <img
                        src={comparisonResult.move_in_photo?.signed_url || moveInPreview || ""}
                        alt={`Move-in ${comparisonResult.area}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-mono text-ink-400">Photo unavailable</span>
                    )}
                  </div>
                </div>

                {/* Move-Out Photo with Markers */}
                <div className="border border-ink-200 bg-page p-3 flex flex-col photo-frame lit">
                  <div className="text-xs font-mono font-semibold text-ink-700 mb-2">
                    MOVE-OUT PHOTO (WITH MARKERS)
                  </div>
                  <div className="aspect-[4/3] bg-ink-100 border border-ink-200 relative overflow-hidden flex items-center justify-center">
                    <div className="relative w-full h-full">
                      {comparisonResult.move_out_photo?.signed_url || moveOutPreview ? (
                        <img
                          src={comparisonResult.move_out_photo?.signed_url || moveOutPreview || ""}
                          alt={`Move-out ${comparisonResult.area}`}
                          className="w-full h-full object-cover block"
                        />
                      ) : (
                        <span className="text-xs font-mono text-ink-400">Photo unavailable</span>
                      )}

                      {/* Numbered Square Finding Markers */}
                      {markers.map((m) => {
                        if (!m.hasBox) return null;
                        const isSelected = selectedFindingId === m.id;
                        const isHovered = hoveredFindingId === m.id;
                        const isLit = isSelected || isHovered;

                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSelectedFindingId(isSelected ? null : m.id)}
                            onMouseEnter={() => setHoveredFindingId(m.id)}
                            onMouseLeave={() => setHoveredFindingId(null)}
                            onFocus={() => setHoveredFindingId(m.id)}
                            onBlur={() => setHoveredFindingId(null)}
                            aria-label={`Finding ${m.index + 1}: ${m.finding.description}`}
                            style={{
                              top: `${m.top}%`,
                              left: `${m.left}%`,
                              transform: "translate(-50%, -50%)",
                            }}
                            className={`absolute w-[28px] h-[28px] rounded-[4px] flex items-center justify-center font-mono text-[12px] font-medium transition-all duration-200 cursor-pointer focus:outline-none ${
                              isLit
                                ? "bg-[#0B3D4A] text-white ring-2 ring-white border-[1.5px] border-[#0B3D4A] z-30"
                                : "bg-[rgba(255,255,255,0.92)] text-[#0B3D4A] border-[1.5px] border-[#0B3D4A] z-20"
                            }`}
                          >
                            {m.index + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Findings Cards List */}
              {comparisonResult.findings.length === 0 ? (
                <div className="p-6 bg-page border border-ink-200 text-left text-xs text-ink-700">
                  <div className="flex items-center space-x-2 text-accepted font-mono text-xs font-bold uppercase mb-1">
                    <span className="w-2 h-2 bg-accepted inline-block"></span>
                    <span>No differences found</span>
                  </div>
                  <p className="text-xs text-ink-600 leading-relaxed font-sans">
                    Both photos were compared and no physical changes or damage were identified.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comparisonResult.findings.map((finding, idx) => {
                    const isSelected = selectedFindingId === finding.id;
                    const isHovered = hoveredFindingId === finding.id;
                    const isRejectOpen = editingRejectId === finding.id;

                    return (
                      <div
                        key={finding.id}
                        onClick={() => setSelectedFindingId(isSelected ? null : finding.id)}
                        onMouseEnter={() => setHoveredFindingId(finding.id)}
                        onMouseLeave={() => setHoveredFindingId(null)}
                        onFocus={() => setHoveredFindingId(finding.id)}
                        onBlur={() => setHoveredFindingId(null)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            if (e.target === e.currentTarget) {
                              e.preventDefault();
                              setSelectedFindingId(isSelected ? null : finding.id);
                            }
                          }
                        }}
                        className={`border p-5 transition-all text-xs cursor-pointer interactive-row lit ${
                          isSelected
                            ? "border-accent bg-accent-tint ring-1 ring-accent"
                            : isHovered
                            ? "border-ink-400 bg-surface"
                            : "border-ink-200 bg-surface"
                        }`}
                      >
                        {/* 1. Number & plain-language title */}
                        <div className="flex items-start space-x-3 mb-2.5">
                          <span
                            className={`w-6 h-6 rounded-[3px] flex items-center justify-center font-mono text-[11px] font-bold flex-shrink-0 mt-0.5 ${
                              isSelected || isHovered
                                ? "bg-accent text-white"
                                : "bg-ink-900 text-white"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-ink-900 font-sans">
                              {finding.description}
                            </h3>

                            {/* 2. Issue Tag + 3. Condition Label + 4. Confidence */}
                            <div className="flex flex-wrap items-center gap-2 mt-2 font-mono text-[11px]">
                              {/* Issue Tag */}
                              <span className="px-2 py-0.5 bg-page text-ink-700 border border-ink-200 rounded-[2px] font-medium">
                                {formatIssueTag(finding.issue_type)}
                              </span>

                              {/* Condition Label */}
                              <span className={getConditionColor(finding)}>
                                {getConditionLabel(finding)}
                              </span>

                              <span>·</span>

                              {/* Confidence in words */}
                              <span className="text-ink-600">
                                {getConfidenceWord(finding.confidence)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Explanatory line under the first card */}
                        {idx === 0 && (
                          <p className="text-[11px] text-ink-500 font-sans italic pl-9 mb-3">
                            Confidence shows how sure the comparison is about this label, not how serious the finding is.
                          </p>
                        )}

                        {/* 5. "What we noticed" (Reasoning) */}
                        {finding.reasoning && (
                          <div className="pl-9 mt-2 text-xs text-ink-700 font-sans bg-page p-3 border border-ink-100">
                            <span className="font-mono text-[10px] uppercase font-bold text-ink-600 block mb-0.5">
                              What we noticed:
                            </span>
                            {finding.reasoning}
                          </div>
                        )}

                        {/* Rejected note display if present */}
                        {finding.decision === "disputed" && finding.decision_note && (
                          <div className="pl-9 mt-2 text-xs text-disputed bg-disputed-bg p-3 border border-disputed-border">
                            <span className="font-mono text-[10px] uppercase font-bold block mb-0.5">
                              Your Note:
                            </span>
                            {finding.decision_note}
                          </div>
                        )}

                        {/* 6. Decision Actions (Accept, Reject, Clear) */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-4 pl-9 pt-3 border-t border-ink-100 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              aria-pressed={finding.decision === "accepted"}
                              onClick={() => handleDecision(finding, "accepted")}
                              disabled={updatingDecisionId === finding.id}
                              className={`min-h-[40px] px-4 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono border transition-colors btn-motion ${
                                finding.decision === "accepted"
                                  ? "bg-accepted text-white border-accepted"
                                  : "border-ink-200 hover:border-accepted text-ink-700 bg-surface lit"
                              }`}
                            >
                              Accept
                            </button>

                            <button
                              type="button"
                              aria-pressed={finding.decision === "disputed"}
                              onClick={() => {
                                setEditingRejectId(isRejectOpen ? null : finding.id);
                                setRejectNote(finding.decision_note || "");
                              }}
                              disabled={updatingDecisionId === finding.id}
                              className={`min-h-[40px] px-4 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono border transition-colors btn-motion ${
                                finding.decision === "disputed"
                                  ? "bg-disputed text-white border-disputed"
                                  : "border-ink-200 hover:border-disputed text-ink-700 bg-surface lit"
                              }`}
                            >
                              Reject
                            </button>

                            {finding.decision !== "pending" && (
                              <button
                                type="button"
                                onClick={() => handleDecision(finding, "pending", "")}
                                disabled={updatingDecisionId === finding.id}
                                className="px-2 py-1 text-xs font-mono text-ink-500 hover:text-ink-900 underline"
                              >
                                Clear
                              </button>
                            )}
                          </div>

                          <div className="font-mono text-[11px]">
                            {finding.decision === "accepted" && (
                              <span className="text-accepted font-bold">✓ Accepted</span>
                            )}
                            {finding.decision === "disputed" && (
                              <span className="text-disputed font-bold">⚠ Rejected</span>
                            )}
                            {finding.decision === "pending" && (
                              <span className="text-ink-500">Not reviewed</span>
                            )}
                          </div>
                        </div>

                        {/* Reject note input textarea */}
                        {isRejectOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="mt-3 pl-9 pt-3 border-t border-ink-100"
                          >
                            <label className="block text-xs font-medium text-ink-700 mb-1">
                              Optional note (max 500 characters):
                            </label>
                            <textarea
                              value={rejectNote}
                              onChange={(e) => setRejectNote(e.target.value)}
                              maxLength={500}
                              rows={2}
                              placeholder="Explain why this difference is preexisting, ordinary wear, or inaccurate..."
                              className="w-full p-2.5 border border-ink-200 text-xs bg-page focus:bg-surface focus:outline-none focus:border-accent font-sans"
                            />
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[10px] font-mono text-ink-400">
                                {rejectNote.length} / 500
                              </span>
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingRejectId(null)}
                                  className="px-3 py-1.5 text-xs text-ink-600 hover:text-ink-900 border border-ink-200 bg-surface btn-motion lit"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDecision(finding, "disputed", rejectNote)}
                                  disabled={updatingDecisionId === finding.id}
                                  className="px-3 py-1.5 text-xs font-semibold bg-disputed text-white hover:opacity-90 btn-motion lit"
                                >
                                  Save Decision
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footers & Disclaimers */}
              <div className="pt-4 border-t border-ink-200 space-y-2 text-xs text-ink-600 font-sans">
                <p>
                  Accept means you agree this is described correctly. It does not mean you agree to pay for anything.
                </p>
                <p className="text-[11px] text-ink-500">
                  This is an automated comparison and can be wrong, especially when the light or angle differs. Check each item against the photos.
                </p>
              </div>
            </section>
          )}

          {/* Section E: "Previous checks" */}
          <div className="bg-surface border border-ink-200 p-6 sm:p-8">
            <div className="border-b border-ink-200 pb-3 mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                  HISTORY
                </div>
                <h2 className="text-base font-bold text-ink-900 mt-0.5">
                  Previous checks
                </h2>
              </div>
              <span className="text-xs font-mono text-ink-500">
                {recentComparisons.length} recorded
              </span>
            </div>

            {loadingRecent ? (
              <div className="space-y-2 py-4 animate-pulse">
                <div className="h-10 bg-page"></div>
                <div className="h-10 bg-page"></div>
              </div>
            ) : recentComparisons.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-ink-200 text-xs text-ink-500 font-mono">
                No previous checks recorded yet. Run a two-photo analysis above to start your log.
              </div>
            ) : (
              <div className="border border-ink-200 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-ink-200 bg-page text-[10px] font-mono uppercase text-ink-500 tracking-wider">
                      <th className="py-3 px-4 font-semibold">AREA</th>
                      <th className="py-3 px-4 font-semibold">DATE</th>
                      <th className="py-3 px-4 font-semibold">SUMMARY</th>
                      <th className="py-3 px-4 font-semibold">REVIEW STATUS</th>
                      <th className="py-3 px-4 font-semibold text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 font-sans">
                    {recentComparisons.map((check) => {
                      const findingCount = check.findings?.length || 0;
                      const allReviewed =
                        findingCount > 0 &&
                        check.findings.every((f) => f.decision !== "pending");
                      const partiallyReviewed =
                        findingCount > 0 &&
                        check.findings.some((f) => f.decision !== "pending") &&
                        !allReviewed;

                      return (
                        <tr
                          key={check.id}
                          className="hover:bg-page/60 transition-colors cursor-pointer"
                          onClick={() => handleSelectPreviousCheck(check)}
                        >
                          <td className="py-3.5 px-4 font-medium text-ink-900">
                            <span className="font-semibold block">{check.area}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-ink-600 whitespace-nowrap">
                            {new Date(check.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-3.5 px-4 text-ink-700">
                            {check.status === "failed" ? (
                              <span className="font-mono text-ink-500">Incomplete</span>
                            ) : findingCount === 0 ? (
                              <span className="text-accepted font-medium">No differences</span>
                            ) : (
                              <span>
                                {findingCount} difference{findingCount === 1 ? "" : "s"}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[10px]">
                            {findingCount === 0 ? (
                              <span className="text-ink-400">—</span>
                            ) : allReviewed ? (
                              <span className="text-accepted font-bold uppercase">Reviewed</span>
                            ) : partiallyReviewed ? (
                              <span className="text-ink-700 uppercase">In progress</span>
                            ) : (
                              <span className="text-ink-400 uppercase">Not reviewed</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectPreviousCheck(check);
                              }}
                              className="text-xs font-mono text-accent hover:underline font-semibold"
                            >
                              Open ↗
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
