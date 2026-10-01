"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
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
}: AreaComparisonCardProps) {
  const isPaired = Boolean(moveInPhoto && moveOutPhoto);
  const [comparing, setComparing] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  // Active highlighted finding
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  // Dispute note editor state per finding
  const [editingDisputeId, setEditingDisputeId] = useState<string | null>(null);
  const [disputeNote, setDisputeNote] = useState("");
  const [updatingDecisionId, setUpdatingDecisionId] = useState<string | null>(null);

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

  const getClassificationBadge = (cls: string) => {
    switch (cls) {
      case "damage":
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono uppercase font-bold bg-damage-bg text-damage border border-damage-border">
            DAMAGE
          </span>
        );
      case "wear":
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono uppercase font-bold bg-wear-bg text-wear border border-wear-border">
            NORMAL WEAR
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono uppercase font-bold bg-unclear-bg text-unclear border border-unclear-border">
            UNCLEAR
          </span>
        );
    }
  };

  const findings = comparison?.findings || [];
  const isComplete = comparison?.status === "complete";
  const isFailed = comparison?.status === "failed";

  return (
    <div className="border border-ink-200 bg-surface p-4 sm:p-6 mb-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-ink-200 pb-4 mb-4 gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
            AREA SPECIMEN & COMPARISON
          </div>
          <h3 className="text-base font-bold text-ink-900 mt-0.5">{area}</h3>
        </div>

        <div className="flex items-center space-x-3">
          {isPaired && !comparing && (
            <>
              {isComplete ? (
                <button
                  onClick={handleRunComparison}
                  className="px-3 py-1.5 text-xs font-mono font-medium text-ink-700 hover:text-ink-900 border border-ink-200 hover:border-ink-400 bg-page transition-colors"
                >
                  ↻ Re-run Comparison
                </button>
              ) : (
                <button
                  onClick={handleRunComparison}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-accent hover:bg-accent-hover transition-colors"
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

      {/* Comparing loading progress */}
      {comparing && (
        <div className="mb-6 p-4 bg-accent-tint border border-accent-border text-xs text-accent flex items-center space-x-3">
          <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="font-mono text-[11px]">Comparing photos — this takes about 10-20 seconds...</span>
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
            onClick={handleRunComparison}
            className="underline font-mono text-xs text-accent font-semibold hover:text-accent-hover ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Side-by-Side Photos Grid (Stacks vertically on mobile) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Move-In Baseline Photo (Left) */}
        <div className="border border-ink-200 bg-page p-3 flex flex-col">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-ink-700 mb-2">
            <span>IMAGE 1: MOVE-IN BASELINE</span>
            {moveInPhoto && (
              <button
                onClick={() => onDeletePhoto(moveInPhoto.id)}
                disabled={deletingPhotoId === moveInPhoto.id}
                className="text-[10px] font-mono text-damage hover:underline"
              >
                Delete
              </button>
            )}
          </div>

          <div className="aspect-[4/3] bg-ink-100 border border-ink-200 relative flex items-center justify-center overflow-hidden">
            {moveInPhoto?.signed_url ? (
              <img
                src={moveInPhoto.signed_url}
                alt={`Move-in ${area}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="text-xs text-ink-400 font-mono">Missing baseline photo</span>
            )}
          </div>

          {moveInPhoto && (
            <div className="mt-2 text-[10px] font-mono text-ink-500 flex justify-between">
              <span>{formatDate(moveInPhoto.created_at)}</span>
              <span title={moveInPhoto.sha256}>sha256 {formatSha(moveInPhoto.sha256)}</span>
            </div>
          )}
        </div>

        {/* Move-Out Departure Photo with Bounding Box Overlays (Right) */}
        <div className="border border-ink-200 bg-page p-3 flex flex-col">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-ink-700 mb-2">
            <span>IMAGE 2: MOVE-OUT DEPARTURE</span>
            {moveOutPhoto && (
              <button
                onClick={() => onDeletePhoto(moveOutPhoto.id)}
                disabled={deletingPhotoId === moveOutPhoto.id}
                className="text-[10px] font-mono text-damage hover:underline"
              >
                Delete
              </button>
            )}
          </div>

          <div className="aspect-[4/3] bg-ink-100 border border-ink-200 relative flex items-center justify-center overflow-hidden">
            {moveOutPhoto?.signed_url ? (
              <div className="relative w-full h-full">
                <img
                  src={moveOutPhoto.signed_url}
                  alt={`Move-out ${area}`}
                  className="w-full h-full object-cover block"
                  loading="lazy"
                />

                {/* Numbered Bounding box overlays */}
                {isComplete &&
                  findings.map((f, idx) => {
                    if (
                      f.box_ymin === null ||
                      f.box_xmin === null ||
                      f.box_ymax === null ||
                      f.box_xmax === null
                    ) {
                      return null;
                    }

                    const top = f.box_ymin / 10;
                    const left = f.box_xmin / 10;
                    const height = (f.box_ymax - f.box_ymin) / 10;
                    const width = (f.box_xmax - f.box_xmin) / 10;
                    const isSelected = selectedFindingId === f.id;

                    // Color border rules: damage = solid muted red, wear = solid ochre, unclear = 2px dashed grey
                    const boxStyle =
                      f.classification === "damage"
                        ? "border-2 border-damage bg-damage/15"
                        : f.classification === "wear"
                        ? "border-2 border-wear bg-wear/15"
                        : "border-2 border-dashed border-unclear bg-unclear/15";

                    const badgeBg =
                      f.classification === "damage"
                        ? "bg-damage text-white"
                        : f.classification === "wear"
                        ? "bg-wear text-white"
                        : "bg-unclear text-white";

                    return (
                      <div
                        key={f.id}
                        onClick={() => setSelectedFindingId(f.id)}
                        style={{
                          top: `${top}%`,
                          left: `${left}%`,
                          width: `${width}%`,
                          height: `${height}%`,
                        }}
                        className={`absolute transition-all cursor-pointer ${boxStyle} ${
                          isSelected ? "ring-2 ring-ink-900 z-20" : "z-10"
                        }`}
                      >
                        <span
                          className={`absolute -top-2.5 -left-2.5 w-4 h-4 rounded-none flex items-center justify-center text-[9px] font-mono font-bold ${badgeBg}`}
                        >
                          {idx + 1}
                        </span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <span className="text-xs text-ink-400 font-mono">Departure photo pending</span>
            )}
          </div>

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
            Confidence is how sure the comparison is about the classification. It is
            not a measure of how serious the finding is. Review each difference and
            select whether you accept the description or dispute it with details.
          </div>

          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-mono font-bold text-ink-900 uppercase tracking-wide">
              Visual Differences Identified ({findings.length})
            </h4>
            {findings.length > 0 && (
              <span className="text-[11px] font-mono text-ink-500">
                Click a finding to locate its box on the move-out photo
              </span>
            )}
          </div>

          {findings.length === 0 ? (
            <div className="p-6 bg-page border border-ink-200 text-center text-xs text-ink-600">
              <span className="font-mono text-xs font-bold text-accepted block mb-1">
                ✓ NO MEANINGFUL CHANGES FOUND
              </span>
              <p>
                Visual surfaces match the baseline move-in photo with no detectable
                damage or excessive wear.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {findings.map((finding, idx) => {
                const isSelected = selectedFindingId === finding.id;
                const isDisputeOpen = editingDisputeId === finding.id;

                return (
                  <div
                    key={finding.id}
                    onClick={() => setSelectedFindingId(finding.id)}
                    className={`border p-4 transition-all text-xs cursor-pointer ${
                      isSelected
                        ? "border-ink-900 bg-surface ring-1 ring-ink-900"
                        : "border-ink-200 bg-surface hover:border-ink-300"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                      <div className="flex items-start space-x-2.5">
                        <span className="w-4 h-4 bg-ink-900 text-white flex items-center justify-center font-mono text-[9px] font-bold flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-ink-900 text-sm">
                            {finding.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {getClassificationBadge(finding.classification)}
                            <span className="text-[10px] font-mono uppercase text-ink-600 px-1.5 py-0.5 bg-page border border-ink-200">
                              {finding.severity} severity
                            </span>
                            <span className="text-[10px] font-mono text-ink-500">
                              {Math.round(finding.confidence * 100)}% confidence
                            </span>
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
                            UNREVIEWED
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Assessment Reasoning */}
                    {finding.reasoning && (
                      <p className="text-ink-600 mt-2 pl-6 leading-relaxed bg-page p-2.5 border border-ink-100">
                        <strong className="text-ink-700 font-mono text-[10px] uppercase block mb-0.5">
                          Reasoning:
                        </strong>
                        {finding.reasoning}
                      </p>
                    )}

                    {/* Disputed note preview */}
                    {finding.decision === "disputed" && finding.decision_note && (
                      <div className="mt-2 pl-6 text-[11px] text-disputed bg-disputed-bg p-2.5 border border-disputed-border">
                        <strong>Tenant Dispute Note:</strong> {finding.decision_note}
                      </div>
                    )}

                    {/* Tenant Review Decision Actions */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 pl-6 pt-2.5 border-t border-ink-100 flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="text-[10px] font-mono uppercase text-ink-500 font-medium">
                        Tenant Decision:
                      </span>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          aria-pressed={finding.decision === "accepted"}
                          onClick={() => handleDecision(finding, "accepted")}
                          disabled={updatingDecisionId === finding.id}
                          className={`px-3 py-1 text-xs font-medium border transition-colors ${
                            finding.decision === "accepted"
                              ? "bg-accepted text-white border-accepted font-bold"
                              : "border-ink-200 hover:border-accepted text-ink-700 bg-surface"
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
                          className={`px-3 py-1 text-xs font-medium border transition-colors ${
                            finding.decision === "disputed"
                              ? "bg-disputed text-white border-disputed font-bold"
                              : "border-ink-200 hover:border-disputed text-ink-700 bg-surface"
                          }`}
                        >
                          Dispute
                        </button>
                      </div>
                    </div>

                    {/* Dispute Note Panel */}
                    {isDisputeOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-3 pl-6 pt-3 border-t border-ink-100"
                      >
                        <label className="block text-[11px] font-medium text-ink-700 mb-1">
                          Reason for Dispute (max 500 characters):
                        </label>
                        <textarea
                          value={disputeNote}
                          onChange={(e) => setDisputeNote(e.target.value)}
                          maxLength={500}
                          rows={2}
                          placeholder="State why this difference is preexisting, landlord-approved, or ordinary wear..."
                          className="w-full p-2 border border-ink-200 text-xs bg-page focus:bg-surface focus:outline-none focus:border-accent"
                        />
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] font-mono text-ink-400">
                            {disputeNote.length} / 500
                          </span>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => setEditingDisputeId(null)}
                              className="px-2.5 py-1 text-xs text-ink-600 hover:text-ink-900 border border-ink-200 bg-surface"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDecision(finding, "disputed", disputeNote)}
                              disabled={updatingDecisionId === finding.id}
                              className="px-3 py-1 text-xs font-semibold bg-disputed text-white hover:opacity-90"
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
