"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import type {
  Property,
  PhotoWithUrl,
  ComparisonWithFindings,
  Finding,
} from "@/types/database";

interface PageProps {
  params: Promise<{ token: string }>;
}

interface ReportData {
  property: Property;
  photos: PhotoWithUrl[];
  comparisons: ComparisonWithFindings[];
  generated_at: string;
}

// Sample dataset for demonstration when token is "sample"
const SAMPLE_REPORT_DATA: ReportData = {
  property: {
    id: "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
    user_id: "sample-user",
    name: "Greenview Residency — Flat 402",
    address: "24th Main Road, Sector 2, HSR Layout, Bengaluru",
    tenancy_start: "2025-07-01",
    tenancy_end: "2026-06-30",
    lease_notes: "Security deposit: ₹60,000. Normal wear and tear accepted over 12-month lease.",
    share_token: "sample",
    created_at: "2025-07-01T10:00:00Z",
  },
  generated_at: new Date().toISOString(),
  photos: [
    {
      id: "p1",
      user_id: "sample-user",
      inspection_id: "i1",
      area: "Living Room — South Wall",
      storage_path: "sample/move_in_1.jpg",
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      width: 1600,
      height: 1200,
      created_at: "2025-07-01T14:32:00Z",
    },
    {
      id: "p2",
      user_id: "sample-user",
      inspection_id: "i2",
      area: "Living Room — South Wall",
      storage_path: "sample/move_out_1.jpg",
      sha256: "3a1c7e9284fa93bc01e23f99014285ad4912bbca812709e4f910382910fae821",
      width: 1600,
      height: 1200,
      created_at: "2026-06-30T11:15:00Z",
    },
    {
      id: "p3",
      user_id: "sample-user",
      inspection_id: "i1",
      area: "Kitchen — Granite Countertop",
      storage_path: "sample/move_in_2.jpg",
      sha256: "721a9c4021bbfe821038592039abfe8129038472910384910384910283910293",
      width: 1600,
      height: 1200,
      created_at: "2025-07-01T14:40:00Z",
    },
    {
      id: "p4",
      user_id: "sample-user",
      inspection_id: "i2",
      area: "Kitchen — Granite Countertop",
      storage_path: "sample/move_out_2.jpg",
      sha256: "8821bc0192837461928374619283746192837461928374619283746192837461",
      width: 1600,
      height: 1200,
      created_at: "2026-06-30T11:22:00Z",
    },
  ],
  comparisons: [
    {
      id: "c1",
      user_id: "sample-user",
      property_id: "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
      area: "Living Room — South Wall",
      move_in_photo_id: "p1",
      move_out_photo_id: "p2",
      status: "complete",
      error: null,
      created_at: "2026-06-30T11:30:00Z",
      findings: [
        {
          id: "f1",
          user_id: "sample-user",
          comparison_id: "c1",
          description: "Small 1.5cm surface scratch in paint above electrical switch plate.",
          classification: "damage",
          severity: "minor",
          confidence: 0.88,
          box_ymin: 220,
          box_xmin: 540,
          box_ymax: 380,
          box_xmax: 720,
          reasoning: "Distinct sharp scratch not visible on move-in baseline photo. Exceeds ordinary ambient contact.",
          decision: "accepted",
          decision_note: null,
          created_at: "2026-06-30T11:30:00Z",
        },
        {
          id: "f2",
          user_id: "sample-user",
          comparison_id: "c1",
          description: "Minor baseboard rubbing consistent with 12 months of residential occupancy.",
          classification: "wear",
          severity: "minor",
          confidence: 0.94,
          box_ymin: 750,
          box_xmin: 320,
          box_ymax: 900,
          box_xmax: 680,
          reasoning: "Gradual surface wear expected over standard 12-month tenancy duration.",
          decision: "accepted",
          decision_note: null,
          created_at: "2026-06-30T11:30:00Z",
        },
      ],
    },
    {
      id: "c2",
      user_id: "sample-user",
      property_id: "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
      area: "Kitchen — Granite Countertop",
      move_in_photo_id: "p3",
      move_out_photo_id: "p4",
      status: "complete",
      error: null,
      created_at: "2026-06-30T11:32:00Z",
      findings: [
        {
          id: "f3",
          user_id: "sample-user",
          comparison_id: "c2",
          description: "Water mineral mark near faucet base.",
          classification: "wear",
          severity: "minor",
          confidence: 0.85,
          box_ymin: 400,
          box_xmin: 600,
          box_ymax: 580,
          box_xmax: 800,
          reasoning: "Mineral scaling from hard water contact over lease period.",
          decision: "disputed",
          decision_note: "Countertop was professionally descaled during move-in and hard water is inherent to building supply.",
          created_at: "2026-06-30T11:32:00Z",
        },
      ],
    },
  ],
};

export default function ReportPage({ params }: PageProps) {
  const { token } = use(params);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token === "sample") {
      setData(SAMPLE_REPORT_DATA);
      setLoading(false);
      return;
    }

    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/reports/${token}`);
        const result = await res.json();
        if (!res.ok || result.error) {
          throw new Error(result.error?.message || "Report could not be found.");
        }
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load report.");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [token]);

  const formatSha = (sha?: string) => {
    if (!sha || sha.length < 12) return sha || "—";
    return `${sha.slice(0, 10)}…${sha.slice(-8)}`;
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

  // Summary statistics
  const totalComparisons = data?.comparisons.length || 0;
  const allFindings = (data?.comparisons || []).flatMap((c) => c.findings || []);
  const totalFindings = allFindings.length;
  const acceptedCount = allFindings.filter((f) => f.decision === "accepted").length;
  const disputedCount = allFindings.filter((f) => f.decision === "disputed").length;
  const pendingCount = allFindings.filter((f) => f.decision === "pending").length;

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-16 text-center text-xs font-mono text-ink-500">
        Compiling inspection evidence document...
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="max-w-lg mx-auto px-4 py-16 text-center text-xs">
        <div className="border border-ink-200 bg-surface p-8">
          <div className="font-mono text-xs text-damage font-bold mb-2">[!] REPORT UNAVAILABLE</div>
          <p className="text-ink-600 mb-6">{error || "Inspection report could not be found."}</p>
          <Link
            href="/"
            className="px-4 py-2 bg-accent text-white text-xs font-semibold uppercase tracking-wider"
          >
            Return to Intact
          </Link>
        </div>
      </main>
    );
  }

  const { property, comparisons, photos } = data;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 print-page">
      {/* Document Sheet */}
      <div className="border border-ink-200 bg-surface p-6 sm:p-10 text-xs">
        {/* Document Header */}
        <div className="border-b-2 border-ink-900 pb-5 mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-[10px] font-mono uppercase text-ink-500 tracking-wider mb-1">
              <span className="w-2 h-2 bg-accent inline-block"></span>
              <span>INTACT · READ-ONLY VERIFICATION RECORD</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-900 uppercase font-sans">
              Move-Out Inspection Report
            </h1>
            <p className="text-xs text-ink-600 mt-0.5">
              Objective condition record comparing move-in baseline and move-out departure photographs.
            </p>
          </div>

          <div className="flex items-center space-x-2 no-print self-start">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 font-mono text-xs border border-ink-300 hover:border-ink-900 bg-page text-ink-900 font-medium"
            >
              [ ⎙ Print Report ]
            </button>
          </div>
        </div>

        {/* Property & Inspection Metadata Table */}
        <div className="border border-ink-200 bg-page p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[11px]">
          <div>
            <span className="font-mono text-[10px] text-ink-500 uppercase block">Property / Unit</span>
            <strong className="text-ink-900 font-semibold">{property.name}</strong>
            {property.address && <div className="text-ink-600 text-[10px] mt-0.5">{property.address}</div>}
          </div>

          <div>
            <span className="font-mono text-[10px] text-ink-500 uppercase block">Tenancy Dates</span>
            <span className="font-mono text-ink-900 font-medium">
              {property.tenancy_start} → {property.tenancy_end || "(Ongoing)"}
            </span>
          </div>

          <div>
            <span className="font-mono text-[10px] text-ink-500 uppercase block">Report Dossier ID</span>
            <span title={property.id} className="font-mono text-[10px] text-ink-700 truncate block">
              {property.id.slice(0, 18)}…
            </span>
          </div>

          <div>
            <span className="font-mono text-[10px] text-ink-500 uppercase block">Compiled Timestamp</span>
            <span className="font-mono text-[10px] text-ink-900">
              {formatDate(data.generated_at)}
            </span>
          </div>
        </div>

        {property.lease_notes && (
          <div className="mb-6 p-3 bg-page border border-ink-200 text-xs">
            <span className="font-mono uppercase font-bold text-[10px] text-ink-500 mr-2">
              Lease Notes / Terms:
            </span>
            <span className="text-ink-700">{property.lease_notes}</span>
          </div>
        )}

        {/* Inspection Summary Block */}
        <div className="border border-ink-200 p-4 mb-8">
          <div className="text-[10px] font-mono uppercase text-ink-500 font-bold mb-3">
            INSPECTION SUMMARY
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
            <div className="p-2 border border-ink-100 bg-page">
              <span className="text-base font-bold text-ink-900 block">{totalComparisons}</span>
              <span className="text-[10px] text-ink-500 uppercase">Areas Compared</span>
            </div>
            <div className="p-2 border border-ink-100 bg-page">
              <span className="text-base font-bold text-ink-900 block">{totalFindings}</span>
              <span className="text-[10px] text-ink-500 uppercase">Total Findings</span>
            </div>
            <div className="p-2 border border-accepted-border bg-accepted-bg text-accepted">
              <span className="text-base font-bold block">{acceptedCount}</span>
              <span className="text-[10px] uppercase">Accepted</span>
            </div>
            <div className="p-2 border border-disputed-border bg-disputed-bg text-disputed">
              <span className="text-base font-bold block">{disputedCount}</span>
              <span className="text-[10px] uppercase">Disputed</span>
            </div>
          </div>
        </div>

        {/* Detailed Findings By Area */}
        <div className="mb-10">
          <div className="border-b border-ink-200 pb-2 mb-6">
            <h2 className="text-sm font-bold text-ink-900 uppercase font-mono tracking-wider">
              Itemized Area Findings & Visual Comparisons
            </h2>
          </div>

          {comparisons.length === 0 ? (
            <div className="p-6 border border-dashed border-ink-200 text-center font-mono text-ink-500">
              No comparison records present for this property.
            </div>
          ) : (
            <div className="space-y-8">
              {comparisons.map((comp) => (
                <div key={comp.id} className="border border-ink-200 p-4 sm:p-5 bg-page">
                  <div className="flex items-center justify-between border-b border-ink-200 pb-2 mb-3">
                    <h3 className="font-bold text-ink-900 text-sm font-mono uppercase">
                      AREA: {comp.area}
                    </h3>
                    <span className="font-mono text-[10px] text-ink-500">
                      {comp.findings.length} finding{comp.findings.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {/* Findings list */}
                  {comp.findings.length === 0 ? (
                    <div className="p-3 bg-surface border border-ink-100 text-xs text-ink-600 font-mono">
                      ✓ No physical changes identified in this area. Move-out condition matches move-in baseline.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {comp.findings.map((f, idx) => (
                        <div
                          key={f.id}
                          className="p-3 bg-surface border border-ink-200 text-xs space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start space-x-2">
                              <span className="font-mono font-bold text-ink-900">
                                #{idx + 1}
                              </span>
                              <div>
                                <span className="font-semibold text-ink-900">
                                  {f.description}
                                </span>
                                <div className="flex items-center gap-2 mt-1">
                                  {getClassificationBadge(f.classification)}
                                  <span className="text-[10px] font-mono text-ink-500 uppercase">
                                    {f.severity} severity · {Math.round(f.confidence * 100)}% confidence
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="font-mono text-[10px] font-bold">
                              {f.decision === "accepted" && (
                                <span className="px-1.5 py-0.5 bg-accepted-bg text-accepted border border-accepted-border">
                                  ✓ ACCEPTED
                                </span>
                              )}
                              {f.decision === "disputed" && (
                                <span className="px-1.5 py-0.5 bg-disputed-bg text-disputed border border-disputed-border">
                                  ⚠ DISPUTED
                                </span>
                              )}
                              {f.decision === "pending" && (
                                <span className="px-1.5 py-0.5 bg-page text-ink-500 border border-ink-200">
                                  NOT REVIEWED
                                </span>
                              )}
                            </div>
                          </div>

                          {f.reasoning && (
                            <div className="text-[11px] text-ink-600 pl-5 leading-relaxed">
                              <strong>Analysis:</strong> {f.reasoning}
                            </div>
                          )}

                          {f.decision === "disputed" && f.decision_note && (
                            <div className="text-[11px] text-disputed bg-disputed-bg p-2 border border-disputed-border pl-5">
                              <strong>Tenant Dispute Note:</strong> {f.decision_note}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cryptographic Photo Record Table */}
        <div className="mb-10">
          <div className="border-b border-ink-200 pb-2 mb-4">
            <h2 className="text-sm font-bold text-ink-900 uppercase font-mono tracking-wider">
              Cryptographic Photo Audit Register
            </h2>
          </div>

          <div className="border border-ink-200 overflow-x-auto bg-surface">
            <table className="w-full text-left text-[11px] font-mono">
              <thead>
                <tr className="bg-page border-b border-ink-200 uppercase text-[10px] text-ink-500">
                  <th className="py-2.5 px-3">AREA</th>
                  <th className="py-2.5 px-3">STAGE</th>
                  <th className="py-2.5 px-3">RECORDED</th>
                  <th className="py-2.5 px-3">SHA-256 HASH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {photos.map((p) => {
                  const stage = p.storage_path.includes("move_in") ? "MOVE-IN" : "MOVE-OUT";
                  return (
                    <tr key={p.id} className="hover:bg-page/50">
                      <td className="py-2.5 px-3 font-sans font-medium text-ink-900">{p.area}</td>
                      <td className="py-2.5 px-3 text-ink-700">{stage}</td>
                      <td className="py-2.5 px-3 text-ink-500">{formatDate(p.created_at)}</td>
                      <td className="py-2.5 px-3 text-ink-600" title={p.sha256}>
                        {formatSha(p.sha256)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mandatory About This Report Notice */}
        <div className="border-t-2 border-ink-200 pt-6 text-[11px] text-ink-600 leading-relaxed bg-page p-4 border">
          <div className="font-mono uppercase font-bold text-ink-700 text-[10px] mb-2">
            ABOUT THIS REPORT
          </div>
          <p className="mb-2">
            This report lists differences found by comparing move-in and move-out
            photos, and the tenant&apos;s response to each. Labels and confidence scores
            come from an automated visual comparison and can be wrong. It is not
            legal advice and does not estimate repair costs or decide who pays.
          </p>
          <p className="font-mono text-[10px] text-ink-500">
            A matching hash shows a photo file has not changed since it was
            uploaded. It does not show when the photo was taken.
          </p>
        </div>
      </div>
    </main>
  );
}
