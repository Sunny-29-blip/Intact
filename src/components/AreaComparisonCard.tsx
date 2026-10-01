"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type {
  PhotoWithUrl,
  ComparisonWithFindings,
  Finding,
  FindingDecision,
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
        setComparisonError("Comparison failed. Please try again.");
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
      alert(err instanceof Error ? err.message : "Failed to update decision");
    } finally {
      setUpdatingDecisionId(null);
    }
  };

  const formatSha = (sha?: string) => {
    if (!sha || sha.length < 12) return sha || "—";
    return `${sha.slice(0, 6)}...${sha.slice(-6)}`;
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
          <span className="px-2 py-0.5 text-[10px] font-mono uppercase font-semibold bg-damage-bg text-damage border border-damage-border rounded-xs">
            Damage
          </span>
        );
      case "wear":
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono uppercase font-semibold bg-wear-bg text-wear border border-wear-border rounded-xs">
            Normal Wear
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono uppercase font-semibold bg-unclear-bg text-unclear border border-unclear-border rounded-xs">
            Unclear
          </span>
        );
    }
  };

  const getSeverityBadge = (sev: string) => {
    return (
      <span className="text-[10px] font-mono text-ink-600 uppercase px-1.5 py-0.5 bg-paper-100 border border-ink-100 rounded-xs">
        {sev} severity
      </span>
    );
  };

  const findings = comparison?.findings || [];
  const isComplete = comparison?.status === "complete";
  const isFailed = comparison?.status === "failed";

  return (
    <div className="border border-ink-200 rounded bg-paper-50 p-4 sm:p-6 mb-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-ink-200 pb-4 mb-4 gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
            Condition Pair & AI Inspection
          </div>
          <h3 className="text-lg font-bold text-ink-900">{area}</h3>
        </div>

        <div className="flex items-center space-x-3">
          {isPaired && !comparing && (
            <>
              {isComplete ? (
                <button
                  onClick={handleRunComparison}
                  className="px-3 py-1.5 text-xs font-mono font-medium text-ink-700 hover:text-ink-900 border border-ink-200 hover:border-ink-400 bg-white rounded transition-colors"
                >
                  ↻ Re-run Comparison
                </button>
              ) : (
                <button
                  onClick={handleRunComparison}
                  className="px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded transition-colors shadow-subtle"
                >
                  Compare (AI Analysis)
                </button>
              )}
            </>
          )}

          {!isPaired && (
            <span className="text-[11px] font-mono px-2 py-1 bg-wear-bg border border-wear-border text-wear rounded">
              Awaiting Move-Out Photo
            </span>
          )}
        </div>
      </div>

      {/* Comparing loading progress */}
      {comparing && (
        <div className="mb-6 p-4 bg-accent-subtle border border-accent-border rounded text-xs text-accent flex items-center space-x-3">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span>Comparing photos — this takes about 10-20 seconds...</span>
        </div>
      )}

      {/* Comparison error / failure banner */}
      {(comparisonError || (isFailed && comparison?.error)) && (
        <div className="mb-6 p-4 bg-damage-bg border border-damage-border rounded text-xs text-damage flex items-center justify-between">
          <span>{comparisonError || comparison?.error || "Comparison failed."}</span>
          <button
            onClick={handleRunComparison}
            className="underline font-semibold hover:text-damage ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Side-by-Side Photos Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Move-In Baseline Photo */}
        <div className="border border-ink-200 rounded bg-white p-3.5 flex flex-col">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-700 mb-2">
            <span>IMAGE 1: MOVE-IN BASELINE</span>
            {moveInPhoto && (
              <button
                onClick={() => onDeletePhoto(moveInPhoto.id)}
                disabled={deletingPhotoId === moveInPhoto.id}
                className="text-[10px] text-damage hover:underline"
              >
                Delete
              </button>
            )}
          </div>

          <div className="aspect-[4/3] bg-paper-100 rounded overflow-hidden relative flex items-center justify-center">
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
            <div className="mt-2.5 text-[11px] font-mono text-ink-600 flex justify-between">
              <span>{formatDate(moveInPhoto.created_at)}</span>
              <span title={moveInPhoto.sha256}>SHA: {formatSha(moveInPhoto.sha256)}</span>
            </div>
          )}
        </div>

        {/* Move-Out Departure Photo with Bounding Box Overlays */}
        <div className="border border-ink-200 rounded bg-white p-3.5 flex flex-col">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-700 mb-2">
            <span>IMAGE 2: MOVE-OUT DEPARTURE</span>
            {moveOutPhoto && (
              <button
                onClick={() => onDeletePhoto(moveOutPhoto.id)}
                disabled={deletingPhotoId === moveOutPhoto.id}
                className="text-[10px] text-damage hover:underline"
              >
                Delete
              </button>
            )}
          </div>

          <div className="aspect-[4/3] bg-paper-100 rounded overflow-hidden relative flex items-center justify-center">
            {moveOutPhoto?.signed_url ? (
              <div className="relative w-full h-full">
                <img
                  src={moveOutPhoto.signed_url}
                  alt={`Move-out ${area}`}
                  className="w-full h-full object-cover block"
                  loading="lazy"
                />

                {/* Bounding box overlays */}
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

                    const colorBorder =
                      f.classification === "damage"
                        ? "border-damage bg-damage/15"
                        : f.classification === "wear"
                        ? "border-wear bg-wear/15"
                        : "border-unclear bg-unclear/15";

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
                        className={`absolute border-2 transition-all cursor-pointer ${colorBorder} ${
                          isSelected ? "ring-2 ring-ink-900 z-20 scale-[1.01]" : "z-10"
                        }`}
                      >
                        <span
                          className={`absolute -top-3 -left-3 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shadow-xs ${badgeBg}`}
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
            <div className="mt-2.5 text-[11px] font-mono text-ink-600 flex justify-between">
              <span>{formatDate(moveOutPhoto.created_at)}</span>
              <span title={moveOutPhoto.sha256}>SHA: {formatSha(moveOutPhoto.sha256)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Findings Analysis Section */}
      {isComplete && (
        <div className="border-t border-ink-200 pt-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-ink-900 uppercase tracking-wide font-mono">
              AI Visual Findings ({findings.length})
            </h4>
            {findings.length > 0 && (
              <span className="text-[11px] text-ink-500">
                Click any finding to locate its bounding box on the move-out photo
              </span>
            )}
          </div>

          {findings.length === 0 ? (
            <div className="p-5 bg-white border border-ink-200 rounded text-center text-xs text-ink-600">
              <div className="w-6 h-6 rounded-full bg-accepted-bg text-accepted border border-accepted-border mx-auto flex items-center justify-center font-bold mb-2">
                ✓
              </div>
              <p className="font-semibold text-ink-900">
                No meaningful changes found in this area.
              </p>
              <p className="text-ink-500 mt-1">
                Visual surfaces match the baseline move-in record with no detectable damage or excessive wear.
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
                    className={`bg-white border rounded p-4 transition-all text-xs cursor-pointer ${
                      isSelected
                        ? "border-ink-900 ring-1 ring-ink-900 shadow-subtle"
                        : "border-ink-200 hover:border-ink-300"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                      <div className="flex items-start space-x-2">
                        <span className="w-5 h-5 rounded-full bg-ink-900 text-white flex items-center justify-center font-mono text-[10px] font-bold flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-ink-900 text-sm">
                            {finding.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {getClassificationBadge(finding.classification)}
                            {getSeverityBadge(finding.severity)}
                            <span className="text-[10px] font-mono text-ink-500">
                              {Math.round(finding.confidence * 100)}% confidence
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Decision state badge */}
                      <div className="flex items-center space-x-1.5 sm:self-start">
                        {finding.decision === "accepted" && (
                          <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-accepted-bg border border-accepted-border text-accepted rounded">
                            ✓ ACCEPTED
                          </span>
                        )}
                        {finding.decision === "disputed" && (
                          <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-disputed-bg border border-disputed-border text-disputed rounded">
                            ⚠ DISPUTED
                          </span>
                        )}
                        {finding.decision === "pending" && (
                          <span className="px-2 py-0.5 text-[10px] font-mono text-ink-500 bg-paper-100 border border-ink-100 rounded">
                            PENDING REVIEW
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Reasoning paragraph */}
                    {finding.reasoning && (
                      <p className="text-ink-600 mt-2 pl-7 leading-relaxed bg-paper-50 p-2.5 rounded border border-ink-100">
                        <strong className="text-ink-700 font-mono text-[10px] uppercase block mb-0.5">
                          Assessment Reasoning:
                        </strong>
                        {finding.reasoning}
                      </p>
                    )}

                    {/* Disputed note display */}
                    {finding.decision === "disputed" && finding.decision_note && (
                      <div className="mt-2 pl-7 text-[11px] text-disputed bg-disputed-bg/50 p-2.5 rounded border border-disputed-border">
                        <strong>Tenant Dispute Note:</strong> {finding.decision_note}
                      </div>
                    )}

                    {/* Decision Action Buttons */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 pl-7 pt-2.5 border-t border-ink-100 flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="text-[11px] text-ink-500 font-medium">
                        Tenant Position:
                      </span>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleDecision(finding, "accepted")}
                          disabled={updatingDecisionId === finding.id}
                          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                            finding.decision === "accepted"
                              ? "bg-accepted text-white"
                              : "border border-ink-200 hover:border-accepted text-ink-700 bg-white"
                          }`}
                        >
                          Accept Change
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingDisputeId(isDisputeOpen ? null : finding.id);
                            setDisputeNote(finding.decision_note || "");
                          }}
                          disabled={updatingDecisionId === finding.id}
                          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                            finding.decision === "disputed"
                              ? "bg-disputed text-white"
                              : "border border-ink-200 hover:border-disputed text-ink-700 bg-white"
                          }`}
                        >
                          Dispute Finding
                        </button>
                      </div>
                    </div>

                    {/* Dispute Note Input Panel */}
                    {isDisputeOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-3 pl-7 pt-3 border-t border-ink-100"
                      >
                        <label className="block text-[11px] font-medium text-ink-700 mb-1">
                          Reason for Dispute (e.g. preexisting mark, landlord agreed in writing, ordinary wear over lease):
                        </label>
                        <textarea
                          value={disputeNote}
                          onChange={(e) => setDisputeNote(e.target.value)}
                          maxLength={500}
                          rows={2}
                          placeholder="Provide details to support your dispute..."
                          className="w-full p-2 border border-ink-200 rounded text-xs bg-paper-50 focus:bg-white focus:outline-none focus:border-accent"
                        />
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] font-mono text-ink-400">
                            {disputeNote.length} / 500 chars
                          </span>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => setEditingDisputeId(null)}
                              className="px-2.5 py-1 text-xs text-ink-600 hover:text-ink-900 border border-ink-200 rounded bg-white"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDecision(finding, "disputed", disputeNote)}
                              disabled={updatingDecisionId === finding.id}
                              className="px-3 py-1 text-xs font-medium bg-disputed text-white rounded hover:opacity-90"
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
        * Note: This is an automated condition comparison to support an objective discussion between tenant and landlord, not a legal or repair-cost assessment.
      </div>
    </div>
  );
}
