import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/properties");
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start border-b border-ink-200 pb-12 mb-12">
        {/* Left Column: Copy & Actions */}
        <div className="lg:col-span-6 flex flex-col justify-center">
          <div className="inline-flex items-center space-x-2 text-[11px] font-mono uppercase text-ink-500 tracking-wider mb-4 border border-ink-200 px-2 py-1 bg-surface self-start">
            <span className="w-2 h-2 bg-accent inline-block"></span>
            <span>FOR TENANTS IN RENTED HOMES, HOSTELS AND PGS</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink-900 leading-[1.18] mb-4">
            Photograph your room when you move in.
            <br />
            <span className="text-accent">Compare it when you move out.</span>
          </h1>

          <p className="text-sm text-ink-600 leading-relaxed mb-8 max-w-xl">
            Intact keeps a dated record of every area you photograph, then lists
            each difference between your move-in and move-out photos. Your deposit
            conversation can be about specific marks, not vague claims.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              Start a move-in record
            </Link>
            <Link
              href="/report/sample"
              className="px-5 py-2.5 bg-surface border border-ink-200 hover:border-ink-400 text-ink-900 text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              See a sample report
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-ink-200 grid grid-cols-2 gap-4 text-xs font-mono text-ink-500">
            <div>
              <span className="block text-ink-900 font-bold text-sm">SHA-256</span>
              <span>Integrity verification per photo</span>
            </div>
            <div>
              <span className="block text-ink-900 font-bold text-sm">3 Categories</span>
              <span>Damage, Normal Wear, Unclear</span>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Inspection Example */}
        <div className="lg:col-span-6">
          <div className="border border-ink-200 bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-ink-200 pb-3 mb-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold text-ink-900">
                  AREA SPECIMEN: BEDROOM — SOUTH WALL
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-accent-tint text-accent border border-accent-border">
                11 MONTH TENANCY
              </span>
            </div>

            {/* Side-by-side demonstration mockup */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Move-In Baseline Mock */}
              <div className="border border-ink-200 bg-page p-2 flex flex-col">
                <div className="text-[10px] font-mono font-semibold text-ink-700 mb-1.5 flex justify-between">
                  <span>MOVE-IN BASELINE</span>
                  <span className="text-ink-500">IMG 01</span>
                </div>
                {/* SVG Visual Baseline */}
                <div className="aspect-[4/3] bg-ink-100 border border-ink-200 relative overflow-hidden flex items-center justify-center">
                  <svg
                    viewBox="0 0 200 150"
                    className="w-full h-full text-ink-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  >
                    {/* Room wall outline */}
                    <rect x="10" y="10" width="180" height="130" fill="#EAECEF" />
                    <line x1="10" y1="110" x2="190" y2="110" stroke="#CBD0D6" strokeWidth="2" />
                    {/* Baseboard */}
                    <rect x="10" y="110" width="180" height="30" fill="#DFE2E6" />
                    {/* Clean Switch Plate */}
                    <rect x="40" y="60" width="20" height="30" fill="#FFFFFF" stroke="#9CA3AF" />
                    <rect x="47" y="70" width="6" height="10" fill="#D1D5DB" />
                  </svg>
                </div>
                <div className="mt-2 text-[9px] font-mono text-ink-500 leading-tight">
                  <div>05 Jul 2025 · 14:22 IST</div>
                  <div className="truncate">sha256 8f3a92...b281</div>
                </div>
              </div>

              {/* Move-Out Departure Mock with Bounding Boxes */}
              <div className="border border-ink-200 bg-page p-2 flex flex-col">
                <div className="text-[10px] font-mono font-semibold text-ink-700 mb-1.5 flex justify-between">
                  <span>MOVE-OUT DEPARTURE</span>
                  <span className="text-accent font-bold">COMPARED</span>
                </div>
                {/* SVG Visual Departure with Bounding Boxes */}
                <div className="aspect-[4/3] bg-ink-100 border border-ink-200 relative overflow-hidden flex items-center justify-center">
                  <svg
                    viewBox="0 0 200 150"
                    className="w-full h-full text-ink-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  >
                    {/* Room wall outline */}
                    <rect x="10" y="10" width="180" height="130" fill="#EAECEF" />
                    <line x1="10" y1="110" x2="190" y2="110" stroke="#CBD0D6" strokeWidth="2" />
                    <rect x="10" y="110" width="180" height="30" fill="#DFE2E6" />
                    {/* Switch Plate */}
                    <rect x="40" y="60" width="20" height="30" fill="#FFFFFF" stroke="#9CA3AF" />
                    <rect x="47" y="70" width="6" height="10" fill="#D1D5DB" />
                    {/* Mark 1: Wall gouge */}
                    <ellipse cx="130" cy="45" rx="10" ry="7" fill="#A63D3D" fillOpacity="0.8" />
                    {/* Mark 2: Baseboard scuff */}
                    <line x1="90" y1="120" x2="140" y2="124" stroke="#8A6A1A" strokeWidth="3" strokeDasharray="2,2" />
                  </svg>

                  {/* Finding Box 1: Damage */}
                  <div
                    style={{ top: "20%", left: "55%", width: "24%", height: "24%" }}
                    className="absolute border-2 border-damage bg-damage/15 pointer-events-none"
                  >
                    <span className="absolute -top-2.5 -left-2.5 w-4 h-4 rounded-none bg-damage text-white font-mono text-[9px] font-bold flex items-center justify-center">
                      1
                    </span>
                  </div>

                  {/* Finding Box 2: Normal Wear */}
                  <div
                    style={{ top: "72%", left: "40%", width: "35%", height: "18%" }}
                    className="absolute border-2 border-wear bg-wear/15 pointer-events-none"
                  >
                    <span className="absolute -top-2.5 -left-2.5 w-4 h-4 rounded-none bg-wear text-white font-mono text-[9px] font-bold flex items-center justify-center">
                      2
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-[9px] font-mono text-ink-500 leading-tight">
                  <div>28 Jun 2026 · 11:05 IST</div>
                  <div className="truncate">sha256 3a1c7e...9d04</div>
                </div>
              </div>
            </div>

            {/* Findings breakdown list */}
            <div className="space-y-2 border-t border-ink-200 pt-3">
              <div className="border border-ink-200 bg-surface p-2 text-xs flex items-start justify-between gap-2">
                <div className="flex items-start space-x-2">
                  <span className="w-4 h-4 bg-damage text-white font-mono text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <div className="font-semibold text-ink-900">
                      Deep 3cm gouge in plaster surface
                    </div>
                    <div className="text-[10px] font-mono text-ink-500 mt-0.5">
                      DAMAGE · Minor severity · 88% confidence
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-accepted-bg text-accepted border border-accepted-border">
                  ACCEPTED
                </span>
              </div>

              <div className="border border-ink-200 bg-surface p-2 text-xs flex items-start justify-between gap-2">
                <div className="flex items-start space-x-2">
                  <span className="w-4 h-4 bg-wear text-white font-mono text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <div className="font-semibold text-ink-900">
                      Light baseboard rubbing consistent with 11-month use
                    </div>
                    <div className="text-[10px] font-mono text-ink-500 mt-0.5">
                      NORMAL WEAR · Minor severity · 92% confidence
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-accepted-bg text-accepted border border-accepted-border">
                  ACCEPTED
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Numbered Documented Workflow Section */}
      <section className="mb-16">
        <div className="border-b border-ink-200 pb-3 mb-8">
          <div className="text-[11px] font-mono uppercase text-ink-500 tracking-wider">
            SYSTEM PROCEDURE
          </div>
          <h2 className="text-xl font-bold text-ink-900 mt-0.5">
            How an Intact Record is Built
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="border-l-2 border-ink-200 pl-4 py-1">
            <span className="font-mono text-xs text-accent font-bold">01</span>
            <h3 className="font-bold text-ink-900 text-sm mt-1 uppercase tracking-wide">
              Record Move-In
            </h3>
            <p className="text-xs text-ink-600 mt-2 leading-relaxed">
              Photograph each room upon arrival. Photos are SHA-256 hashed and
              safely archived in encrypted private storage.
            </p>
          </div>

          <div className="border-l-2 border-ink-200 pl-4 py-1">
            <span className="font-mono text-xs text-accent font-bold">02</span>
            <h3 className="font-bold text-ink-900 text-sm mt-1 uppercase tracking-wide">
              Record Move-Out
            </h3>
            <p className="text-xs text-ink-600 mt-2 leading-relaxed">
              Upon departure, photograph the exact corresponding areas to form
              side-by-side inspection pairs.
            </p>
          </div>

          <div className="border-l-2 border-ink-200 pl-4 py-1">
            <span className="font-mono text-xs text-accent font-bold">03</span>
            <h3 className="font-bold text-ink-900 text-sm mt-1 uppercase tracking-wide">
              Compare
            </h3>
            <p className="text-xs text-ink-600 mt-2 leading-relaxed">
              Visual differences are identified and classified into DAMAGE,
              NORMAL WEAR, or UNCLEAR conditioned on tenancy duration.
            </p>
          </div>

          <div className="border-l-2 border-ink-200 pl-4 py-1">
            <span className="font-mono text-xs text-accent font-bold">04</span>
            <h3 className="font-bold text-ink-900 text-sm mt-1 uppercase tracking-wide">
              Review + Share
            </h3>
            <p className="text-xs text-ink-600 mt-2 leading-relaxed">
              Review findings, accept accurate notes or dispute with context,
              and export a shareable read-only inspection report.
            </p>
          </div>
        </div>
      </section>

      {/* Trust & Boundary Notice */}
      <section className="border border-ink-200 bg-surface p-6 sm:p-8 text-xs text-ink-600 leading-relaxed">
        <div className="font-mono text-[10px] uppercase font-bold text-ink-500 mb-2">
          OPERATIONAL BOUNDARIES & INTEGRITY NOTICE
        </div>
        <p className="mb-2">
          Intact is an objective condition documentation tool to support fact-based
          conversations between tenants and landlords. Automated visual comparisons
          identify differences and suggest classifications based on tenancy duration,
          but do not constitute legal advice, liability determinations, or repair-cost
          estimations.
        </p>
        <p className="font-mono text-[11px] text-ink-500">
          A matching SHA-256 hash proves that the photo file has remained byte-for-byte
          identical since its upload timestamp. It does not certify the original camera
          capture moment.
        </p>
      </section>
    </main>
  );
}
