"use client";

import { useState, useMemo } from "react";
import { api, ApiError } from "@/lib/api";
import { SHOW_REGION_HINT_ON_SELECT } from "@/lib/config";
import type {
  PhotoWithUrl,
  ComparisonWithFindings,
  Finding,
} from "@/types/database";

interface AreaComparisonCardProps {
  propertyId: string;
  area: string;
  moveInPhoto?: PhotoWithUrl;
  moveOutPhoto?: PhotoWithUrl;
  comparison?: ComparisonWithFindings;
  onComparisonUpdated: (updated: ComparisonWithFindings) => void;
  onDeletePhoto: (photoId: string) => void;
  deletingPhotoId: string | null;
  onDirectUpload?: (area: string, kind: "move_in" | "move_out", file: File) => Promise<void>;
}

interface CalculatedMarker {
  id: string;
  index: number;
  finding: Finding;
  hasBox: boolean;
  left: number;
  top: number;
  box?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export function AreaComparisonCard({
  propertyId,
  area,
  moveInPhoto,
  moveOutPhoto,
  comparison,
  onComparisonUpdated,
  onDeletePhoto,
  deletingPhotoId,
  onDirectUpload,
}: AreaComparisonCardProps) {
  const isPaired = Boolean(moveInPhoto && moveOutPhoto);
  const [comparing, setComparing] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [localUploading, setLocalUploading] = useState<"move_in" | "move_out" | null>(null);

  // Active highlighted / selected finding
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [hoveredFindingId, setHoveredFindingId] = useState<string | null>(null);

  // Dispute note editor state per finding
  const [editingDisputeId, setEditingDisputeId] = useState<string | null>(null);
  const [disputeNote, setDisputeNote] = useState("");
  const [updatingDecisionId, setUpdatingDecisionId] = useState<string | null>(null);

  const handleFilePicked = async (kind: "move_in" | "move_out", file: File) => {
    if (!onDirectUpload) return;
    setLocalUploading(kind);
    try {
      await onDirectUpload(area, kind, file);
    } catch (err) {
      console.error(err);
    } finally {
      setLocalUploading(null);
    }
  };

  const findings = useMemo(() => comparison?.findings || [], [comparison]);
  const isComplete = comparison?.status === "complete";
  const isFailed = comparison?.status === "failed";

  // Calculate centered numbered markers with collision avoidance
  const markers = useMemo<CalculatedMarker[]>(() => {
    const placed: CalculatedMarker[] = [];

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

      // Nudge if too close to an existing marker (within ~5% in x and y)
      for (const prev of placed) {
        if (
          prev.hasBox &&
          Math.abs(prev.left - left) < 5 &&
          Math.abs(prev.top - top) < 6
        ) {
          top = Math.min(96, top + 6.5);
        }
      }

      const box = {
        top: f.box_ymin / 10,
        left: f.box_xmin / 10,
        height: Math.max(2, (f.box_ymax - f.box_ymin) / 10),
        width: Math.max(2, (f.box_xmax - f.box_xmin) / 10),
      };

      placed.push({
        id: f.id,
        index: idx,
        finding: f,
        hasBox: true,
        left,
        top,
        box,
      });
    });

    return placed;
  }, [findings]);

  const handleRunComparison = async () => {
    if (!isPaired) return;
    setComparing(true);
    setComparisonError(null);
    setSelectedFindingId(null);

    try {
      const result = await api.triggerComparison(propertyId, area);
      onComparisonUpdated(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setComparisonError(err.message);
      } else {
        setComparisonError("Comparison could not be completed. Please try again.");
      }
    } finally {
      setComparing(false);
    }
  };

  const handleDecision = async (
    finding: Finding,
    decision: "accepted" | "disputed",
    note?: string
  ) => {
    setUpdatingDecisionId(finding.id);
    try {
      const updatedFinding = await api.updateFindingDecision(finding.id, {
        decision,
        note: note ?? finding.decision_note ?? undefined,
      });

      if (comparison) {
        const updatedList = comparison.findings.map((f) =>
          f.id === finding.id ? updatedFinding : f
        );
        onComparisonUpdated({
          ...comparison,
          findings: updatedList,
        });
      }
      setEditingDisputeId(null);
      setDisputeNote("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save decision");
    } finally {
      setUpdatingDecisionId(null);
    }
  };

  const formatSha = (sha?: string) => {
    if (!sha || sha.length < 12) return sha || "—";
    return `${sha.slice(0, 8)}…${sha.slice(-6)}`;
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

  const getClassificationLabel = (cls: string) => {
    switch (cls) {
      case "damage":
        return "DAMAGE";
      case "wear":
        return "NORMAL WEAR";
      default:
        return "UNCLEAR";
    }
  };

  const getMarkerStyle = (f: Finding, isLit: boolean) => {
    const isDamage = f.classification === "damage";
    const isWear = f.classification === "wear";

    if (isLit) {
      if (isDamage) return "bg-damage text-white border-2 border-damage";
      if (isWear) return "bg-wear text-white border-2 border-wear";
      return "bg-unclear text-white border-2 border-dashed border-unclear";
    }

    if (isDamage) return "bg-surface text-damage border-2 border-damage";
    if (isWear) return "bg-surface text-wear border-2 border-wear";
    return "bg-surface text-unclear border-2 border-dashed border-unclear";
  };

  return (
    <div className="border border-ink-200 bg-surface p-4 sm:p-6 mb-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-ink-200 pb-4 mb-4 gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
            AREA RECORD & COMPARISON
          </div>
          <h3 className="text-base font-bold text-ink-900 mt-0.5">{area}</h3>
        </div>

        <div className="flex items-center space-x-3">
          {isPaired && !comparing && (
            <>
              {isComplete ? (
                <button
                  type="button"
                  onClick={handleRunComparison}
                  className="px-3 py-1.5 text-xs font-mono font-medium text-ink-700 hover:text-ink-900 border border-ink-200 hover:border-ink-400 bg-page transition-colors btn-motion lit"
                >
                  ↻ Re-run Comparison
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRunComparison}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-accent hover:bg-accent-hover transition-colors btn-motion lit-dark"
                >
                  Compare Area Photos
                </button>
              )}
            </>
          )}

          {!isPaired && (
            <span className="text-[10px] font-mono uppercase px-2 py-1 bg-wear-bg border border-wear-border text-wear font-medium">
              Awaiting Move-Out Photo
            </span>
          )}
        </div>
      </div>

      {/* Comparing loading progress state (Phase 7 specification) */}
      {comparing && (
        <div className="mb-6 p-4 sm:p-5 bg-page border border-ink-200 text-xs">
          <div className="flex items-center justify-between border-b border-ink-200 pb-2 mb-3">
            <span className="font-mono text-[11px] uppercase font-bold text-accent tracking-wider">
              COMPARING RECORDS
            </span>
            <span className="font-mono text-[10px] text-ink-500">
              Processing inspection pair
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-ink-700 mb-2">
            <span className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-accent inline-block"></span>
              <span>MOVE-IN BASELINE</span>
            </span>
            <span className="text-ink-400">⟷</span>
            <span className="flex items-center space-x-2">
              <span>MOVE-OUT DEPARTURE</span>
              <span className="w-1.5 h-1.5 bg-accent inline-block"></span>
            </span>
          </div>

          <div className="w-full bg-ink-100 h-1 relative overflow-hidden mb-2">
            <div className="absolute inset-y-0 left-0 bg-accent w-1/3 animate-pulse"></div>
          </div>

          <p className="text-ink-600 text-[11px] font-sans">
            Comparing the two photos. This takes about 10 to 20 seconds.
          </p>
        </div>
      )}

      {/* Comparison error / failure banner */}
      {(comparisonError || (isFailed && comparison?.error)) && (
        <div className="mb-6 p-4 bg-page border border-ink-300 text-xs text-ink-700 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="font-mono uppercase font-bold text-[10px] text-ink-500">Notice</div>
            <div>{comparisonError || comparison?.error || "Comparison could not be completed."}</div>
          </div>
          <button
            type="button"
            onClick={handleRunComparison}
            className="underline font-mono text-xs text-accent font-semibold hover:text-accent-hover ml-4 btn-motion"
          >
            Retry
          </button>
        </div>
      )}

      {/* Side-by-Side Photos Grid (Stacks vertically on mobile) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Move-In Baseline Photo (Left) */}
        <div className="border border-ink-200 bg-page p-3 flex flex-col photo-frame lit">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-ink-700 mb-2">
            <div className="flex items-center space-x-2">
              <span>MOVE-IN BASELINE</span>
              {moveInPhoto ? (
                <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold bg-accepted-bg text-accepted border border-accepted-border">
                  PHOTO RECORDED
                </span>
              ) : (
                <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold bg-wear-bg text-wear border border-wear-border">
                  PHOTO NEEDED
                </span>
              )}
            </div>
            {moveInPhoto && (
              <button
                type="button"
                onClick={() => onDeletePhoto(moveInPhoto.id)}
                disabled={deletingPhotoId === moveInPhoto.id}
                className="text-[10px] font-mono text-damage hover:underline"
              >
                Delete
              </button>
            )}
          </div>

          {moveInPhoto?.signed_url ? (
            <div className="aspect-[4/3] bg-ink-100 border border-ink-200 relative flex items-center justify-center overflow-hidden">
              <img
                src={moveInPhoto.signed_url}
                alt={`Move-in ${area}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <label className="aspect-[4/3] bg-surface border-2 border-dashed border-ink-300 hover:border-accent relative flex flex-col items-center justify-center cursor-pointer transition-colors p-4 text-center group">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={localUploading === "move_in"}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFilePicked("move_in", file);
                }}
              />
              <div className="w-10 h-10 border border-ink-200 group-hover:border-accent text-ink-400 group-hover:text-accent flex items-center justify-center mb-2 font-mono text-base transition-colors bg-page">
                {localUploading === "move_in" ? "…" : "+"}
              </div>
              <span className="font-mono text-xs font-bold text-ink-800 uppercase tracking-wider group-hover:text-accent transition-colors">
                {localUploading === "move_in" ? "UPLOADING PHOTO..." : "UPLOAD MOVE-IN PHOTOGRAPH"}
              </span>
              <span className="text-[10px] font-mono text-ink-500 mt-1">
                Click to record arrival baseline photo
              </span>
            </label>
          )}

          {moveInPhoto && (
            <div className="mt-2 text-[10px] font-mono text-ink-500 flex justify-between">
              <span>{formatDate(moveInPhoto.created_at)}</span>
              <span title={moveInPhoto.sha256}>sha256 {formatSha(moveInPhoto.sha256)}</span>
            </div>
          )}
        </div>

        {/* Move-Out Departure Photo (Right) */}
        <div className="border border-ink-200 bg-page p-3 flex flex-col photo-frame lit">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-ink-700 mb-2">
            <div className="flex items-center space-x-2">
              <span>MOVE-OUT DEPARTURE</span>
              {moveOutPhoto ? (
                <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold bg-accepted-bg text-accepted border border-accepted-border">
                  PHOTO RECORDED
                </span>
              ) : (
                <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold bg-wear-bg text-wear border border-wear-border">
                  PHOTO NEEDED
                </span>
              )}
            </div>
            {moveOutPhoto && (
              <button
                type="button"
                onClick={() => onDeletePhoto(moveOutPhoto.id)}
                disabled={deletingPhotoId === moveOutPhoto.id}
                className="text-[10px] font-mono text-damage hover:underline"
              >
                Delete
              </button>
            )}
          </div>

          {moveOutPhoto?.signed_url ? (
            <div className="aspect-[4/3] bg-ink-100 border border-ink-200 relative flex items-center justify-center overflow-hidden">
              <div className="relative w-full h-full">
                <img
                  src={moveOutPhoto.signed_url}
                  alt={`Move-out ${area}`}
                  className="w-full h-full object-cover block"
                  loading="lazy"
                />

                {/* Optional Faint Region Hint on explicit selection */}
                {SHOW_REGION_HINT_ON_SELECT &&
                  isComplete &&
                  markers.map((m) => {
                    if (!m.hasBox || !m.box || selectedFindingId !== m.id) return null;
                    return (
                      <div
                        key={`hint-${m.id}`}
                        style={{
                          top: `${m.box.top}%`,
                          left: `${m.box.left}%`,
                          width: `${m.box.width}%`,
                          height: `${m.box.height}%`,
                        }}
                        className="absolute border border-dashed border-ink-700/45 pointer-events-none transition-opacity duration-300 z-10"
                      />
                    );
                  })}

                {/* Numbered Square Finding Markers */}
                {isComplete &&
                  markers.map((m) => {
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
                          transform: `translate(-50%, -50%) ${isLit ? "scale(1.08)" : "scale(1)"}`,
                        }}
                        className={`absolute w-[24px] h-[24px] sm:w-[22px] sm:h-[22px] rounded-none flex items-center justify-center font-mono text-[11px] sm:text-[10px] font-bold shadow-none transition-transform duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent after:absolute after:-inset-2.5 after:content-[''] ${
                          isLit ? "z-30" : "z-20"
                        } ${getMarkerStyle(m.finding, isLit)}`}
                      >
                        {m.index + 1}
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : (
            <label className="aspect-[4/3] bg-surface border-2 border-dashed border-ink-300 hover:border-accent relative flex flex-col items-center justify-center cursor-pointer transition-colors p-4 text-center group">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={localUploading === "move_out"}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFilePicked("move_out", file);
                }}
              />
              <div className="w-10 h-10 border border-ink-200 group-hover:border-accent text-ink-400 group-hover:text-accent flex items-center justify-center mb-2 font-mono text-base transition-colors bg-page">
                {localUploading === "move_out" ? "…" : "+"}
              </div>
              <span className="font-mono text-xs font-bold text-ink-800 uppercase tracking-wider group-hover:text-accent transition-colors">
                {localUploading === "move_out" ? "UPLOADING PHOTO..." : "UPLOAD MOVE-OUT PHOTOGRAPH"}
              </span>
              <span className="text-[10px] font-mono text-ink-500 mt-1">
                Click to record departure verification photo
              </span>
            </label>
          )}

          {moveOutPhoto && (
            <div className="mt-2 text-[10px] font-mono text-ink-500 flex justify-between">
              <span>{formatDate(moveOutPhoto.created_at)}</span>
              <span title={moveOutPhoto.sha256}>sha256 {formatSha(moveOutPhoto.sha256)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Findings Review Panel */}
      {isComplete && (
        <div className="border-t border-ink-200 pt-5">
          {/* Honesty Notice */}
          <div className="mb-4 p-3 bg-page border border-ink-200 text-xs text-ink-600 leading-relaxed">
            <strong className="font-mono text-[10px] uppercase text-ink-700 block mb-0.5">
              Confidence & Review Guidance:
            </strong>
            Confidence is how sure the comparison is about the label. It is not a measure of how serious the finding is. Review each difference and select whether you accept the description or dispute it with details.
          </div>

          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-mono font-bold text-ink-900 uppercase tracking-wide">
              Visual Differences Identified ({findings.length})
            </h4>
            {findings.length > 0 && (
              <span className="text-[11px] font-mono text-ink-500">
                Click or hover a finding to link with photo marker
              </span>
            )}
          </div>

          {findings.length === 0 ? (
            <div className="p-6 bg-page border border-ink-200 text-left text-xs text-ink-700">
              <div className="flex items-center space-x-2 text-accepted font-mono text-xs font-bold uppercase mb-1.5">
                <span className="w-2 h-2 bg-accepted inline-block"></span>
                <span>NO DIFFERENCES RECORDED</span>
              </div>
              <p className="text-xs text-ink-600 leading-relaxed font-sans mb-2">
                This area was compared and no physical difference or damage was detected between the move-in baseline and move-out departure photographs.
              </p>
              <div className="text-[10px] font-mono text-ink-500">
                This area remains in the record as evidence of unchanged condition.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {findings.map((finding, idx) => {
                const isSelected = selectedFindingId === finding.id;
                const isHovered = hoveredFindingId === finding.id;
                const isDisputeOpen = editingDisputeId === finding.id;
                const hasNoBox =
                  finding.box_ymin === null ||
                  finding.box_xmin === null ||
                  finding.box_ymax === null ||
                  finding.box_xmax === null;

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
                    className={`border p-4 transition-all text-xs cursor-pointer interactive-row lit ${
                      isSelected
                        ? "border-ink-900 bg-surface ring-1 ring-ink-900"
                        : isHovered
                        ? "border-ink-400 bg-surface"
                        : "border-ink-200 bg-surface"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                      <div className="flex items-start space-x-2.5">
                        <span
                          className={`w-[22px] h-[22px] flex items-center justify-center font-mono text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                            isSelected || isHovered
                              ? finding.classification === "damage"
                                ? "bg-damage text-white"
                                : finding.classification === "wear"
                                ? "bg-wear text-white"
                                : "bg-unclear text-white"
                              : "bg-ink-900 text-white"
                          }`}
                        >
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <p className="font-semibold text-ink-900 text-sm">
                            {finding.description}
                          </p>

                          {/* Formatted metadata mono line (Phase 4 requirement) */}
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <span className="font-mono text-[11px] text-ink-700 uppercase font-semibold">
                              {getClassificationLabel(finding.classification)} · {finding.severity} severity · {Math.round(finding.confidence * 100)}% confidence
                            </span>
                            {hasNoBox && (
                              <span className="font-mono text-[10px] text-ink-500 bg-page px-1.5 py-0.5 border border-ink-200">
                                Location not marked
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Decision state badge */}
                      <div className="flex items-center space-x-1.5 sm:self-start">
                        {finding.decision === "accepted" && (
                          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-accepted-bg border border-accepted-border text-accepted">
                            ✓ ACCEPTED
                          </span>
                        )}
                        {finding.decision === "disputed" && (
                          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-disputed-bg border border-disputed-border text-disputed">
                            ⚠ DISPUTED
                          </span>
                        )}
                        {finding.decision === "pending" && (
                          <span className="px-2 py-0.5 text-[10px] font-mono text-ink-500 bg-page border border-ink-200">
                            NOT REVIEWED
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Assessment Reasoning */}
                    {finding.reasoning && (
                      <p className="text-ink-600 mt-2 pl-7 leading-relaxed bg-page p-2.5 border border-ink-100">
                        <strong className="text-ink-700 font-mono text-[10px] uppercase block mb-0.5">
                          Reasoning:
                        </strong>
                        {finding.reasoning}
                      </p>
                    )}

                    {/* Disputed note preview */}
                    {finding.decision === "disputed" && finding.decision_note && (
                      <div className="mt-2 pl-7 text-[11px] text-disputed bg-disputed-bg p-2.5 border border-disputed-border">
                        <strong>Tenant Dispute Note:</strong> {finding.decision_note}
                      </div>
                    )}

                    {/* Tenant Review Decision Actions */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 pl-7 pt-2.5 border-t border-ink-100 flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="text-[10px] font-mono uppercase text-ink-500 font-medium">
                        Tenant Decision:
                      </span>

                      <div className="flex items-center space-x-2 font-mono text-xs">
                        <button
                          type="button"
                          aria-pressed={finding.decision === "accepted"}
                          onClick={() => handleDecision(finding, "accepted")}
                          disabled={updatingDecisionId === finding.id}
                          className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider border transition-colors btn-motion ${
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
                            setEditingDisputeId(isDisputeOpen ? null : finding.id);
                            setDisputeNote(finding.decision_note || "");
                          }}
                          disabled={updatingDecisionId === finding.id}
                          className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider border transition-colors btn-motion ${
                            finding.decision === "disputed"
                              ? "bg-disputed text-white border-disputed"
                              : "border-ink-200 hover:border-disputed text-ink-700 bg-surface lit"
                          }`}
                        >
                          Dispute
                        </button>

                        {finding.decision !== "pending" && (
                          <button
                            type="button"
                            onClick={() => handleDecision(finding, "pending" as any, "")}
                            disabled={updatingDecisionId === finding.id}
                            className="px-2 py-1 text-[10px] font-mono text-ink-500 hover:text-ink-900 underline"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Dispute Note Panel */}
                    {isDisputeOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-3 pl-7 pt-3 border-t border-ink-100"
                      >
                        <label className="block text-[11px] font-medium text-ink-700 mb-1">
                          Reason for Dispute (max 500 characters):
                        </label>
                        <textarea
                          value={disputeNote}
                          onChange={(e) => setDisputeNote(e.target.value)}
                          maxLength={500}
                          rows={2}
                          placeholder="State why this difference is preexisting, landlord-approved, or ordinary normal wear..."
                          className="w-full p-2 border border-ink-200 text-xs bg-page focus:bg-surface focus:outline-none focus:border-accent font-sans"
                        />
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] font-mono text-ink-400">
                            {disputeNote.length} / 500
                          </span>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => setEditingDisputeId(null)}
                              className="px-2.5 py-1 text-xs text-ink-600 hover:text-ink-900 border border-ink-200 bg-surface btn-motion lit"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDecision(finding, "disputed", disputeNote)}
                              disabled={updatingDecisionId === finding.id}
                              className="px-3 py-1 text-xs font-semibold bg-disputed text-white hover:opacity-90 btn-motion lit"
                            >
                              Save Dispute
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
        </div>
      )}

      {/* Mandatory Disclaimer Footer */}
      <div className="mt-4 pt-3 border-t border-ink-100 text-[10px] font-mono text-ink-500 leading-relaxed">
        * Notice: Intact provides automated visual condition comparison to support
        discussion between tenant and landlord. It does not provide legal advice,
        determine liability, or estimate repair costs.
      </div>
    </div>
  );
}

