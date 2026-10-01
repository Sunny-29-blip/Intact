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
        <div className="lg:col-span-6 flex flex-col justify-center animate-reveal-up">
          <div className="inline-flex items-center space-x-2 text-[11px] font-mono uppercase text-ink-500 tracking-wider mb-4 border border-ink-200 px-2 py-1 bg-surface self-start lit">
            <span className="w-2 h-2 bg-accent inline-block"></span>
            <span>TENANT-SIDE MOVE-IN / MOVE-OUT RECORD</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink-900 leading-[1.18] mb-4">
            Photograph your room when you move in.
            <br />
            <span className="text-accent">Compare it when you move out.</span>
          </h1>

          <p className="text-sm text-ink-600 leading-relaxed mb-8 max-w-xl">
            Intact keeps a dated record of every area you photograph, then lists
            each difference between your move-in and move-out photos — area by area,
            with the reasoning written down.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors btn-motion lit-dark"
            >
              Start a move-in record
            </Link>
            <Link
              href="/report/sample"
              className="px-5 py-2.5 bg-surface border border-ink-200 hover:border-ink-400 text-ink-900 text-xs font-semibold uppercase tracking-wider transition-colors btn-motion lit"
            >
              See a sample report
            </Link>
          </div>

          {/* Restrained Metadata Strip */}
          <div className="mt-8 pt-6 border-t border-ink-200 grid grid-cols-4 gap-3 text-xs font-mono">
            <div className="border border-ink-200 bg-surface p-2.5 text-center">
              <span className="block text-ink-900 font-bold text-base">14</span>
              <span className="text-[10px] text-ink-500 uppercase">Areas</span>
            </div>
            <div className="border border-ink-200 bg-surface p-2.5 text-center">
              <span className="block text-ink-900 font-bold text-base">2</span>
              <span className="text-[10px] text-ink-500 uppercase">Stages</span>
            </div>
            <div className="border border-ink-200 bg-surface p-2.5 text-center">
              <span className="block text-ink-900 font-bold text-base">05</span>
              <span className="text-[10px] text-ink-500 uppercase">Findings</span>
            </div>
            <div className="border border-ink-200 bg-surface p-2.5 text-center">
              <span className="block text-accent font-bold text-xs uppercase pt-1">Sheet</span>
              <span className="text-[10px] text-ink-500 uppercase">Compare</span>
            </div>
          </div>
        </div>

        {/* Right Column: Hero Comparison Sheet */}
        <div className="lg:col-span-6 animate-reveal-up" style={{ animationDelay: "120ms" }}>
          <div className="border border-ink-200 bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-ink-200 pb-3 mb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-ink-500 block">
                  AREA 03 — BEDROOM, NORTH WALL
                </span>
                <span className="text-xs font-mono font-bold text-ink-900">
                  COMPARISON SPECIMEN
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-accent-tint text-accent border border-accent-border">
                11 MONTH TENANCY
              </span>
            </div>

            {/* Side-by-side photograph pair */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Move-In Baseline Photo */}
              <div className="border border-ink-200 bg-page p-2 flex flex-col photo-frame lit">
                <div className="text-[10px] font-mono font-semibold text-ink-700 mb-1.5 flex justify-between">
                  <span>MOVE-IN</span>
                  <span className="text-ink-500">12 MAR · 11:04</span>
                </div>
                <div className="aspect-[4/3] bg-ink-100 border border-ink-200 relative overflow-hidden flex items-center justify-center">
                  <svg viewBox="0 0 200 150" className="w-full h-full text-ink-400" fill="none" stroke="currentColor" strokeWidth="1">
                    <rect x="10" y="10" width="180" height="130" fill="#EAECEF" />
                    <line x1="10" y1="110" x2="190" y2="110" stroke="#CBD0D6" strokeWidth="2" />
                    <rect x="10" y="110" width="180" height="30" fill="#DFE2E6" />
                    <rect x="40" y="60" width="20" height="30" fill="#FFFFFF" stroke="#9CA3AF" />
                    <rect x="47" y="70" width="6" height="10" fill="#D1D5DB" />
                  </svg>
                </div>
                <div className="mt-1.5 text-[9px] font-mono text-ink-500">
                  sha256 8f3a92...b281
                </div>
              </div>

              {/* Move-Out Departure Photo with Inspection Markers */}
              <div className="border border-ink-200 bg-page p-2 flex flex-col photo-frame lit">
                <div className="text-[10px] font-mono font-semibold text-ink-700 mb-1.5 flex justify-between">
                  <span>MOVE-OUT</span>
                  <span className="text-accent font-bold">COMPARED</span>
                </div>
                <div className="aspect-[4/3] bg-ink-100 border border-ink-200 relative overflow-hidden flex items-center justify-center">
                  <svg viewBox="0 0 200 150" className="w-full h-full text-ink-400" fill="none" stroke="currentColor" strokeWidth="1">
                    <rect x="10" y="10" width="180" height="130" fill="#EAECEF" />
                    <line x1="10" y1="110" x2="190" y2="110" stroke="#CBD0D6" strokeWidth="2" />
                    <rect x="10" y="110" width="180" height="30" fill="#DFE2E6" />
                    <rect x="40" y="60" width="20" height="30" fill="#FFFFFF" stroke="#9CA3AF" />
                    <rect x="47" y="70" width="6" height="10" fill="#D1D5DB" />
                    <ellipse cx="130" cy="45" rx="8" ry="5" fill="#A63D3D" fillOpacity="0.85" />
                    <line x1="90" y1="120" x2="140" y2="124" stroke="#8A6A1A" strokeWidth="2.5" strokeDasharray="2,2" />
                    <circle cx="155" cy="25" r="2" fill="#5A5F66" />
                  </svg>

                  {/* Numbered Marker 01: Damage */}
                  <div
                    style={{ top: "30%", left: "65%", transform: "translate(-50%, -50%)" }}
                    className="absolute w-[22px] h-[22px] bg-surface border-2 border-damage text-damage font-mono text-[10px] font-bold flex items-center justify-center"
                  >
                    01
                  </div>

                  {/* Numbered Marker 02: Normal Wear */}
                  <div
                    style={{ top: "81%", left: "58%", transform: "translate(-50%, -50%)" }}
                    className="absolute w-[22px] h-[22px] bg-surface border-2 border-wear text-wear font-mono text-[10px] font-bold flex items-center justify-center"
                  >
                    02
                  </div>

                  {/* Numbered Marker 03: Unclear */}
                  <div
                    style={{ top: "18%", left: "78%", transform: "translate(-50%, -50%)" }}
                    className="absolute w-[22px] h-[22px] bg-surface border-2 border-dashed border-unclear text-unclear font-mono text-[10px] font-bold flex items-center justify-center"
                  >
                    03
                  </div>
                </div>
                <div className="mt-1.5 text-[9px] font-mono text-ink-500">
                  sha256 3a1c7e...9d04
                </div>
              </div>
            </div>

            {/* Findings breakdown list */}
            <div className="space-y-2 border-t border-ink-200 pt-3">
              <div className="border border-ink-200 bg-surface p-2 text-xs flex items-start justify-between gap-2 interactive-row lit">
                <div className="flex items-start space-x-2">
                  <span className="w-[22px] h-[22px] bg-damage text-white font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    01
                  </span>
                  <div>
                    <div className="font-semibold text-ink-900">
                      Deep gouge in plaster surface
                    </div>
                    <div className="text-[10px] font-mono text-ink-500 mt-0.5">
                      DAMAGE · 88% confidence
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-accepted-bg text-accepted border border-accepted-border">
                  ACCEPTED
                </span>
              </div>

              <div className="border border-ink-200 bg-surface p-2 text-xs flex items-start justify-between gap-2 interactive-row lit">
                <div className="flex items-start space-x-2">
                  <span className="w-[22px] h-[22px] bg-wear text-white font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    02
                  </span>
                  <div>
                    <div className="font-semibold text-ink-900">
                      Baseboard rubbing along skirting
                    </div>
                    <div className="text-[10px] font-mono text-ink-500 mt-0.5">
                      NORMAL WEAR · 92% confidence
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-accepted-bg text-accepted border border-accepted-border">
                  ACCEPTED
                </span>
              </div>

              <div className="border border-ink-200 bg-surface p-2 text-xs flex items-start justify-between gap-2 interactive-row lit">
                <div className="flex items-start space-x-2">
                  <span className="w-[22px] h-[22px] bg-unclear text-white font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    03
                  </span>
                  <div>
                    <div className="font-semibold text-ink-900">
                      Three small fixing marks near picture rail
                    </div>
                    <div className="text-[10px] font-mono text-ink-500 mt-0.5">
                      UNCLEAR · 61% confidence
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-page text-ink-500 border border-ink-200">
                  NOT REVIEWED
                </span>
              </div>
            </div>

            <div className="mt-3 text-[10px] font-mono text-ink-500 border-t border-ink-100 pt-2">
              Markers are inspection references, not detections. Each number points to one line in the finding list.
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 01: REAL INSPECTION EXAMPLE */}
      <section className="border-b border-ink-200 pb-12 mb-12 animate-reveal-up" style={{ animationDelay: "180ms" }}>
        <div className="flex items-center justify-between border-b border-ink-200 pb-3 mb-6">
          <div>
            <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
              SECTION 01 · CASE EVIDENCE
            </div>
            <h2 className="text-xl font-bold text-ink-900 mt-0.5">
              Real Inspection Example
            </h2>
          </div>
          <span className="text-xs font-mono text-ink-600 hidden sm:inline">
            Flat 4, Carlow House — Bengaluru — Indiranagar
          </span>
        </div>

        <div className="border border-ink-200 bg-surface p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Finding Item 01 */}
            <div className="border border-ink-200 bg-page p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start space-x-2">
                    <span className="w-5 h-5 bg-damage text-white font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      01
                    </span>
                    <h3 className="font-semibold text-ink-900 text-sm">
                      Chipped laminate edge beside appliance recess
                    </h3>
                  </div>
                  <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-disputed-bg text-disputed border border-disputed-border">
                    DISPUTED
                  </span>
                </div>
                <div className="text-[10px] font-mono text-ink-600 uppercase mb-3 pl-7">
                  DAMAGE · Moderate severity · 84% confidence
                </div>
                <p className="text-xs text-ink-600 leading-relaxed pl-7 bg-surface p-2.5 border border-ink-100">
                  <strong className="text-ink-700 font-mono text-[10px] uppercase block mb-0.5">
                    Reasoning:
                  </strong>
                  Worktop edge shows a lifted chip approximately 40 mm long. Tenant notes the appliance was pre-installed at move-in.
                </p>
              </div>
            </div>

            {/* Finding Item 02 */}
            <div className="border border-ink-200 bg-page p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start space-x-2">
                    <span className="w-5 h-5 bg-wear text-white font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      02
                    </span>
                    <h3 className="font-semibold text-ink-900 text-sm">
                      Grout discolouration above counter
                    </h3>
                  </div>
                  <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-accepted-bg text-accepted border border-accepted-border">
                    ACCEPTED
                  </span>
                </div>
                <div className="text-[10px] font-mono text-ink-600 uppercase mb-3 pl-7">
                  NORMAL WEAR · Minor severity · 90% confidence
                </div>
                <p className="text-xs text-ink-600 leading-relaxed pl-7 bg-surface p-2.5 border border-ink-100">
                  <strong className="text-ink-700 font-mono text-[10px] uppercase block mb-0.5">
                    Reasoning:
                  </strong>
                  Even darkening of grout lines consistent with routine kitchen use and steam.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-ink-100 text-xs">
            <span className="text-ink-500 font-mono text-[11px]">
              Every difference is paired with verified move-in & move-out photos.
            </span>
            <Link
              href="/properties"
              className="text-accent font-semibold font-mono text-xs hover:underline flex items-center space-x-1"
            >
              <span>Open the comparison screen</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 02: HOW INTACT WORKS (5-Stage Procedure) */}
      <section className="border-b border-ink-200 pb-12 mb-12 animate-reveal-up" style={{ animationDelay: "240ms" }}>
        <div className="border-b border-ink-200 pb-3 mb-8">
          <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
            SECTION 02 · SYSTEM PROCEDURE
          </div>
          <h2 className="text-xl font-bold text-ink-900 mt-0.5">
            How Intact Works
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="border-l-2 border-ink-200 pl-4 py-1 lit">
            <span className="font-mono text-xs text-accent font-bold">01</span>
            <h3 className="font-bold text-ink-900 text-sm mt-1 uppercase tracking-wide">
              Create the Property
            </h3>
            <p className="text-xs text-ink-600 mt-2 leading-relaxed">
              Address, tenancy dates, and the list of areas you intend to photograph. The area list becomes the structure of the whole record.
            </p>
          </div>

          <div className="border-l-2 border-ink-200 pl-4 py-1 lit">
            <span className="font-mono text-xs text-accent font-bold">02</span>
            <h3 className="font-bold text-ink-900 text-sm mt-1 uppercase tracking-wide">
              Record Move-In
            </h3>
            <p className="text-xs text-ink-600 mt-2 leading-relaxed">
              Photograph each area once. Every photo is stamped with its area number, date and time, so nothing is left loose in a camera roll.
            </p>
          </div>

          <div className="border-l-2 border-ink-200 pl-4 py-1 lit">
            <span className="font-mono text-xs text-accent font-bold">03</span>
            <h3 className="font-bold text-ink-900 text-sm mt-1 uppercase tracking-wide">
              Record Move-Out
            </h3>
            <p className="text-xs text-ink-600 mt-2 leading-relaxed">
              At the end of the tenancy you are shown the original photo of each area and asked for the matching one.
            </p>
          </div>

          <div className="border-l-2 border-ink-200 pl-4 py-1 lit">
            <span className="font-mono text-xs text-accent font-bold">04</span>
            <h3 className="font-bold text-ink-900 text-sm mt-1 uppercase tracking-wide">
              Compare and Review
            </h3>
            <p className="text-xs text-ink-600 mt-2 leading-relaxed">
              Each difference is listed as a numbered finding: damage, normal wear, or unclear. You accept or dispute each one yourself.
            </p>
          </div>

          <div className="border-l-2 border-ink-200 pl-4 py-1 lit">
            <span className="font-mono text-xs text-accent font-bold">05</span>
            <h3 className="font-bold text-ink-900 text-sm mt-1 uppercase tracking-wide">
              Issue the Report
            </h3>
            <p className="text-xs text-ink-600 mt-2 leading-relaxed">
              A dated inspection report with the photo record attached, shareable as a read-only link.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 03: WHAT INTACT DOES NOT DO (Scope of the Record) */}
      <section className="border-b border-ink-200 pb-12 mb-12 animate-reveal-up" style={{ animationDelay: "300ms" }}>
        <div className="border-b border-ink-200 pb-3 mb-6">
          <div className="text-[10px] font-mono uppercase text-ink-500 tracking-wider">
            SECTION 03 · OPERATIONAL BOUNDARIES
          </div>
          <h2 className="text-xl font-bold text-ink-900 mt-0.5">
            What Intact Does Not Do
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-ink-200 bg-surface p-4 lit">
            <span className="font-mono text-[10px] font-bold text-ink-500 uppercase block mb-1">
              SCOPE 01
            </span>
            <h3 className="font-bold text-ink-900 text-sm mb-2 uppercase">
              Decide Who Pays
            </h3>
            <p className="text-xs text-ink-600 leading-relaxed">
              Intact records condition. It has no view on deposits, deductions or liability.
            </p>
          </div>

          <div className="border border-ink-200 bg-surface p-4 lit">
            <span className="font-mono text-[10px] font-bold text-ink-500 uppercase block mb-1">
              SCOPE 02
            </span>
            <h3 className="font-bold text-ink-900 text-sm mb-2 uppercase">
              Contact Your Landlord
            </h3>
            <p className="text-xs text-ink-600 leading-relaxed">
              Nothing is sent anywhere. You choose when, and with whom, to share a report.
            </p>
          </div>

          <div className="border border-ink-200 bg-surface p-4 lit">
            <span className="font-mono text-[10px] font-bold text-ink-500 uppercase block mb-1">
              SCOPE 03
            </span>
            <h3 className="font-bold text-ink-900 text-sm mb-2 uppercase">
              Score Your Property
            </h3>
            <p className="text-xs text-ink-600 leading-relaxed">
              There is no rating, no index and no benchmark. Only your own photographs.
            </p>
          </div>

          <div className="border border-ink-200 bg-surface p-4 lit">
            <span className="font-mono text-[10px] font-bold text-ink-500 uppercase block mb-1">
              SCOPE 04
            </span>
            <h3 className="font-bold text-ink-900 text-sm mb-2 uppercase">
              Judge Unclear Evidence
            </h3>
            <p className="text-xs text-ink-600 leading-relaxed">
              Where the photographs cannot support a conclusion, the finding is marked UNCLEAR and left to you.
            </p>
          </div>
        </div>
      </section>

      {/* Final Action Callout */}
      <section className="border border-ink-200 bg-surface p-6 sm:p-10 text-center animate-reveal-up" style={{ animationDelay: "360ms" }}>
        <h2 className="text-2xl font-bold text-ink-900 mb-2">
          Open your move-in record today.
        </h2>
        <p className="text-xs text-ink-600 max-w-lg mx-auto mb-6 leading-relaxed">
          A record is most useful when it is opened on handover day — before anything is unpacked, moved or cleaned.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wider transition-colors btn-motion lit-dark"
          >
            Start a move-in record
          </Link>
          <Link
            href="/login"
            className="px-5 py-2.5 bg-page border border-ink-200 hover:border-ink-400 text-ink-900 text-xs font-semibold uppercase tracking-wider transition-colors btn-motion lit"
          >
            I already have a record
          </Link>
        </div>
      </section>
    </main>
  );
}
