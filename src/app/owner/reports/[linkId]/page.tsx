"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getContractStatus } from "@/lib/contract-status";

interface FindingItem {
  id: string;
  description: string;
  classification: string;
  severity: string;
  issue_type?: string | null;
  confidence_word: string;
  decision_word: string;
  decision_note?: string | null;
  box_ymin?: number | null;
  box_xmin?: number | null;
  box_ymax?: number | null;
  box_xmax?: number | null;
}

interface ComparisonItem {
  id: string;
  area: string;
  status: string;
  findings: FindingItem[];
  move_in_photo?: { signed_url?: string; created_at: string } | null;
  move_out_photo?: { signed_url?: string; created_at: string } | null;
}

interface OwnerReportData {
  link_id: string;
  shared_at: string;
  owner_property: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
  };
  tenant_property: {
    id: string;
    name: string;
    address: string | null;
    tenant_name: string;
    tenancy_start: string;
    tenancy_end: string | null;
  };
  comparisons: ComparisonItem[];
}

export default function OwnerReportViewPage({
  params,
}: {
  params: Promise<{ linkId: string }>;
}) {
  const { linkId } = use(params);
  const [data, setData] = useState<OwnerReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/owner/reports/${linkId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("This condition report is not available or sharing has been revoked by the tenant.");
          } else if (res.status === 403) {
            setError("You do not have permission to view this report.");
          } else {
            setError("Failed to load condition report.");
          }
          setLoading(false);
          return;
        }
        const json = await res.json();
        setData(json.data);
        if (json.data?.comparisons?.length > 0) {
          setSelectedArea(json.data.comparisons[0].area);
        }
      } catch {
        setError("A network error occurred while loading the report.");
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [linkId]);

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="p-12 text-center font-mono text-xs text-ink-500 animate-pulse">
          Loading shared condition record...
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="border border-ink-200 bg-surface p-8 sm:p-12">
          <div className="text-[10px] font-mono uppercase text-ink-500 mb-1">
            RECORD NOT ACCESSIBLE
          </div>
          <h1 className="text-xl font-bold text-ink-900 mb-2">
            Condition Report Unavailable
          </h1>
          <p className="text-xs text-ink-600 mb-6 leading-relaxed">
            {error || "Report could not be retrieved."}
          </p>
          <Link
            href="/owner"
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors inline-block"
          >
            ← Return to Owner Register
          </Link>
        </div>
      </main>
    );
  }

  const contractStatus = getContractStatus(
    data.tenant_property.tenancy_end,
    data.tenant_property.tenancy_start
  );

  const activeComp =
    data.comparisons.find((c) => c.area === selectedArea) ||
    data.comparisons[0] ||
    null;

  const totalFindings = data.comparisons.reduce(
    (acc, c) => acc + c.findings.length,
    0
  );

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-ink-200 pb-5 mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-ink-500 tracking-wider">
            <Link href="/owner" className="hover:text-ink-900 underline">
              OWNER PORTAL
            </Link>
            <span>/</span>
            <span>SHARED CONDITION RECORD</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-900 mt-1">
            {data.tenant_property.name}
          </h1>
          <div className="text-xs text-ink-600 font-mono mt-1 flex flex-wrap items-center gap-2">
            <span>Tenant: {data.tenant_property.tenant_name}</span>
            <span>·</span>
            <span>Contract: {contractStatus.label}</span>
            <span>·</span>
            <span>{data.comparisons.length} compared areas</span>
            <span>·</span>
            <span>{totalFindings} findings</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 text-[10px] font-mono uppercase font-semibold bg-accepted-bg text-accepted border border-accepted-border">
            READ-ONLY VERIFIED RECORD
          </span>
          <Link
            href="/owner"
            className="px-3 py-2 border border-ink-300 hover:border-ink-500 bg-surface text-ink-800 text-xs font-mono uppercase font-semibold transition-colors"
          >
            ← Back
          </Link>
        </div>
      </div>

      {/* Area selection tabs */}
      {data.comparisons.length > 0 ? (
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-ink-200 overflow-x-auto pb-2">
            {data.comparisons.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedArea(c.area)}
                className={`px-3 py-2 text-xs font-mono uppercase font-semibold whitespace-nowrap border transition-colors ${
                  selectedArea === c.area
                    ? "bg-accent text-white border-accent"
                    : "bg-surface text-ink-700 border-ink-200 hover:border-ink-400"
                }`}
              >
                {c.area} ({c.findings.length})
              </button>
            ))}
          </div>

          {activeComp && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Side-by-side photos */}
              <div className="lg:col-span-7 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Move-in photo */}
                  <div className="border border-ink-200 bg-page p-3 space-y-2">
                    <div className="text-[10px] font-mono uppercase text-ink-500 font-bold">
                      01 · MOVE-IN BASELINE
                    </div>
                    {activeComp.move_in_photo?.signed_url ? (
                      <div className="aspect-video bg-black/5 border border-ink-200 overflow-hidden relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={activeComp.move_in_photo.signed_url}
                          alt="Move-in photo"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-page border border-dashed border-ink-300 flex items-center justify-center font-mono text-[11px] text-ink-400">
                        No photo recorded
                      </div>
                    )}
                  </div>

                  {/* Move-out photo */}
                  <div className="border border-ink-200 bg-page p-3 space-y-2">
                    <div className="text-[10px] font-mono uppercase text-ink-500 font-bold">
                      02 · MOVE-OUT DEPARTURE
                    </div>
                    {activeComp.move_out_photo?.signed_url ? (
                      <div className="aspect-video bg-black/5 border border-ink-200 overflow-hidden relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={activeComp.move_out_photo.signed_url}
                          alt="Move-out photo"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-page border border-dashed border-ink-300 flex items-center justify-center font-mono text-[11px] text-ink-400">
                        No photo recorded
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Findings breakdown */}
              <div className="lg:col-span-5 space-y-4">
                <div className="border-b border-ink-200 pb-2 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-ink-500 font-bold">
                    FINDINGS FOR {activeComp.area}
                  </span>
                  <span className="text-xs font-mono text-ink-600">
                    {activeComp.findings.length} findings
                  </span>
                </div>

                {activeComp.findings.length === 0 ? (
                  <div className="p-6 border border-ink-200 bg-page text-center font-mono text-xs text-ink-500">
                    No differences or wear detected in this area.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeComp.findings.map((f, idx) => (
                      <div
                        key={f.id}
                        className="p-4 border border-ink-200 bg-surface space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-ink-900">
                            #{String(idx + 1).padStart(2, "0")} {f.issue_type || "Finding"}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 font-mono text-[10px] uppercase font-semibold border ${
                              f.decision_word === "Accepted"
                                ? "bg-accepted-bg text-accepted border-accepted-border"
                                : f.decision_word === "Rejected"
                                ? "bg-wear-bg text-wear border-wear-border"
                                : "bg-page text-ink-600 border-ink-200"
                            }`}
                          >
                            Tenant: {f.decision_word}
                          </span>
                        </div>

                        <p className="text-ink-800 leading-relaxed font-sans">
                          {f.description}
                        </p>

                        <div className="pt-2 border-t border-ink-100 flex items-center justify-between text-[10px] font-mono text-ink-500">
                          <span>Classification: {f.classification}</span>
                          <span>Confidence: {f.confidence_word}</span>
                        </div>

                        {f.decision_note && (
                          <div className="p-2 bg-page border border-ink-200 text-[11px] text-ink-700 italic">
                            Tenant Note: &quot;{f.decision_note}&quot;
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-12 border border-ink-200 bg-surface text-center font-mono text-xs text-ink-500">
          No comparison areas recorded for this property yet.
        </div>
      )}
    </main>
  );
}
