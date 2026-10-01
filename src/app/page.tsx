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
    <main className="w-full">
      {/* =========================================================================
          HERO & RECORD 01 — TENANT-SIDE
          ========================================================================= */}
      <section className="border-b border-ink-200">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16 lg:py-20">
          {/* Left Hero Column */}
          <div className="flex flex-col justify-center animate-reveal-up">
            <div className="flex items-center gap-4">
              <span className="font-mono text-xs uppercase tracking-wider text-ink-900 font-bold">
                Record 01
              </span>
              <span aria-hidden="true" className="h-px flex-1 bg-ink-200" />
              <span className="font-mono text-[11px] text-ink-500 uppercase tracking-widest">
                TENANT-SIDE
              </span>
            </div>

            <h1 className="mt-8 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-ink-900 leading-[1.15]">
              Photograph your room when you move in.
              <span className="block text-ink-500 font-normal">
                Compare it when you move out.
              </span>
            </h1>

            <p className="mt-7 max-w-md text-sm sm:text-base leading-relaxed text-ink-600 font-sans">
              Intact keeps a dated record of every area you photograph, then lists
              each difference between your move-in and move-out photos — area by area,
              with the reasoning written down.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="inline-flex min-h-12 items-center border border-accent bg-accent px-6 font-mono text-xs uppercase tracking-[0.16em] text-white hover:bg-accent-hover transition-colors btn-motion lit-dark"
              >
                Start a move-in record
              </Link>
              <Link
                href="/report/sample"
                className="inline-flex min-h-12 items-center border border-ink-300 bg-surface px-6 font-mono text-xs uppercase tracking-[0.16em] text-ink-900 hover:border-ink-500 transition-colors btn-motion lit"
              >
                See a sample report
              </Link>
            </div>

            {/* Restrained Metadata DL */}
            <dl className="mt-12 grid grid-cols-3 border-t border-ink-200 font-mono">
              <div className="border-r border-ink-200 py-4 pr-4">
                <dt className="text-[10px] uppercase text-ink-500 tracking-wider">Areas</dt>
                <dd className="mt-1.5 text-lg font-bold text-ink-900">14</dd>
              </div>
              <div className="border-r border-ink-200 py-4 pr-4 pl-4 sm:pl-6">
                <dt className="text-[10px] uppercase text-ink-500 tracking-wider">Stages</dt>
                <dd className="mt-1.5 text-lg font-bold text-ink-900">2</dd>
              </div>
              <div className="py-4 pl-4 sm:pl-6">
                <dt className="text-[10px] uppercase text-ink-500 tracking-wider">Findings</dt>
                <dd className="mt-1.5 text-lg font-bold text-ink-900">05</dd>
              </div>
            </dl>
          </div>

          {/* Right Hero Column: Comparison Sheet Specimen */}
          <div className="lg:pl-6 animate-reveal-up" style={{ animationDelay: "140ms" }}>
            <div className="border border-ink-200 bg-surface">
              {/* Specimen Header */}
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-200 px-5 py-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-ink-500 font-bold">
                    Comparison sheet
                  </div>
                  <div className="mt-1 text-sm font-semibold text-ink-900">
                    Area 03 — Bedroom, North wall
                  </div>
                </div>
                <div className="font-mono text-xs text-ink-600 font-semibold">
                  IN-2291-R07
                </div>
              </div>

              {/* Side-by-side photograph pair with real downloaded inspection photos */}
              <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
                {/* Move-In Photo */}
                <div className="border border-ink-200 bg-page p-3 flex flex-col photo-frame lit">
                  <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-ink-700 mb-2">
                    <span className="uppercase text-ink-900 font-bold">MOVE-IN</span>
                    <span className="text-ink-500">12 Mar 2024 · 11:04</span>
                  </div>
                  <div className="aspect-[4/3] bg-ink-100 border border-ink-200 relative overflow-hidden flex items-center justify-center">
                    <img
                      src="/assets/area-03-movein.jpg"
                      alt="Bedroom, north wall — original condition"
                      className="w-full h-full object-cover"
                    />
                    {/* Numbered Marker 01 */}
                    <div
                      style={{ top: "38%", left: "26%", transform: "translate(-50%, -50%)" }}
                      className="absolute w-[22px] h-[22px] bg-surface border-2 border-damage text-damage font-mono text-[10px] font-bold flex items-center justify-center shadow-none z-20"
                    >
                      01
                    </div>
                    {/* Numbered Marker 02 */}
                    <div
                      style={{ top: "79%", left: "48%", transform: "translate(-50%, -50%)" }}
                      className="absolute w-[22px] h-[22px] bg-surface border-2 border-wear text-wear font-mono text-[10px] font-bold flex items-center justify-center shadow-none z-20"
                    >
                      02
                    </div>
                    {/* Numbered Marker 03 */}
                    <div
                      style={{ top: "13%", left: "61%", transform: "translate(-50%, -50%)" }}
                      className="absolute w-[22px] h-[22px] bg-surface border-2 border-dashed border-unclear text-unclear font-mono text-[10px] font-bold flex items-center justify-center shadow-none z-20"
                    >
                      03
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] font-mono text-ink-500">
                    Bedroom, north wall — original condition
                  </div>
                </div>

                {/* Move-Out Photo */}
                <div className="border border-ink-200 bg-page p-3 flex flex-col photo-frame lit">
                  <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-ink-700 mb-2">
                    <span className="uppercase text-ink-900 font-bold">MOVE-OUT</span>
                    <span className="text-ink-500">27 Sep 2026 · 17:42</span>
                  </div>
                  <div className="aspect-[4/3] bg-ink-100 border border-ink-200 relative overflow-hidden flex items-center justify-center">
                    <img
                      src="/assets/area-03-moveout.jpg"
                      alt="Bedroom, north wall — final condition"
                      className="w-full h-full object-cover"
                    />
                    {/* Numbered Marker 01 */}
                    <div
                      style={{ top: "38%", left: "26%", transform: "translate(-50%, -50%)" }}
                      className="absolute w-[22px] h-[22px] bg-damage text-white border-2 border-damage font-mono text-[10px] font-bold flex items-center justify-center shadow-none z-20"
                    >
                      01
                    </div>
                    {/* Numbered Marker 02 */}
                    <div
                      style={{ top: "79%", left: "48%", transform: "translate(-50%, -50%)" }}
                      className="absolute w-[22px] h-[22px] bg-wear text-white border-2 border-wear font-mono text-[10px] font-bold flex items-center justify-center shadow-none z-20"
                    >
                      02
                    </div>
                    {/* Numbered Marker 03 */}
                    <div
                      style={{ top: "13%", left: "61%", transform: "translate(-50%, -50%)" }}
                      className="absolute w-[22px] h-[22px] bg-surface border-2 border-dashed border-unclear text-unclear font-mono text-[10px] font-bold flex items-center justify-center shadow-none z-20"
                    >
                      03
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] font-mono text-ink-500">
                    Bedroom, north wall — final condition
                  </div>
                </div>
              </div>

              {/* Findings List */}
              <div className="border-t border-ink-200 px-5 py-4">
                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-500 font-bold">
                  Findings
                </div>
                <ul className="mt-3 divide-y divide-ink-100">
                  <li className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 interactive-row lit">
                    <span className="font-mono text-xs font-bold text-ink-900 w-5">01</span>
                    <span className="text-xs sm:text-sm text-ink-900 font-medium">
                      Deep gouge in plaster surface
                    </span>
                    <span className="ml-auto px-2 py-0.5 text-[10px] font-mono font-bold bg-damage-bg text-damage border border-damage-border">
                      DAMAGE
                    </span>
                    <span className="font-mono text-[11px] text-ink-500 w-12 text-right">
                      88%
                    </span>
                  </li>

                  <li className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 interactive-row lit">
                    <span className="font-mono text-xs font-bold text-ink-900 w-5">02</span>
                    <span className="text-xs sm:text-sm text-ink-900 font-medium">
                      Baseboard rubbing along skirting
                    </span>
                    <span className="ml-auto px-2 py-0.5 text-[10px] font-mono font-bold bg-wear-bg text-wear border border-wear-border">
                      NORMAL WEAR
                    </span>
                    <span className="font-mono text-[11px] text-ink-500 w-12 text-right">
                      92%
                    </span>
                  </li>

                  <li className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 interactive-row lit">
                    <span className="font-mono text-xs font-bold text-ink-900 w-5">03</span>
                    <span className="text-xs sm:text-sm text-ink-900 font-medium">
                      Three small fixing marks near picture rail
                    </span>
                    <span className="ml-auto px-2 py-0.5 text-[10px] font-mono font-bold bg-unclear-bg text-unclear border border-unclear-border">
                      UNCLEAR
                    </span>
                    <span className="font-mono text-[11px] text-ink-500 w-12 text-right">
                      61%
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <p className="mt-3 text-xs text-ink-500 font-sans leading-relaxed">
              Markers are inspection references, not detections. Each number points to one line in the finding list.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 02 — A REAL INSPECTION EXAMPLE
          ========================================================================= */}
      <section className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8 border-b border-ink-200">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-ink-200 pb-4 mb-8 gap-2">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-xs font-bold text-ink-900">02</span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-900">
              A real inspection example
            </h2>
          </div>
          <span className="font-mono text-xs text-ink-600">
            Flat 4, Carlow House · Bengaluru — Indiranagar
          </span>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)] items-start">
          {/* Photos Pair */}
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Kitchen Move-In */}
            <div className="border border-ink-200 bg-page p-3 flex flex-col photo-frame lit">
              <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-ink-700 mb-2">
                <span className="uppercase text-ink-900 font-bold">MOVE-IN</span>
                <span className="text-ink-500">12 Mar 2024 · 11:26</span>
              </div>
              <div className="aspect-[4/3] bg-ink-100 border border-ink-200 relative overflow-hidden">
                <img
                  src="/assets/area-07-movein.jpg"
                  alt="Kitchen, counter & splashback — move-in"
                  className="w-full h-full object-cover"
                />
                <div
                  style={{ top: "56%", left: "70%", transform: "translate(-50%, -50%)" }}
                  className="absolute w-[22px] h-[22px] bg-surface border-2 border-damage text-damage font-mono text-[10px] font-bold flex items-center justify-center z-20"
                >
                  01
                </div>
                <div
                  style={{ top: "24%", left: "36%", transform: "translate(-50%, -50%)" }}
                  className="absolute w-[22px] h-[22px] bg-surface border-2 border-wear text-wear font-mono text-[10px] font-bold flex items-center justify-center z-20"
                >
                  02
                </div>
              </div>
              <div className="mt-2 text-[10px] font-mono text-ink-500">
                Kitchen, counter & splashback
              </div>
            </div>

            {/* Kitchen Move-Out */}
            <div className="border border-ink-200 bg-page p-3 flex flex-col photo-frame lit">
              <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-ink-700 mb-2">
                <span className="uppercase text-ink-900 font-bold">MOVE-OUT</span>
                <span className="text-ink-500">27 Sep 2026 · 18:03</span>
              </div>
              <div className="aspect-[4/3] bg-ink-100 border border-ink-200 relative overflow-hidden">
                <img
                  src="/assets/area-07-moveout.jpg"
                  alt="Kitchen, counter & splashback — move-out"
                  className="w-full h-full object-cover"
                />
                <div
                  style={{ top: "62%", left: "70%", transform: "translate(-50%, -50%)" }}
                  className="absolute w-[22px] h-[22px] bg-damage text-white border-2 border-damage font-mono text-[10px] font-bold flex items-center justify-center z-20"
                >
                  01
                </div>
                <div
                  style={{ top: "20%", left: "36%", transform: "translate(-50%, -50%)" }}
                  className="absolute w-[22px] h-[22px] bg-wear text-white border-2 border-wear font-mono text-[10px] font-bold flex items-center justify-center z-20"
                >
                  02
                </div>
              </div>
              <div className="mt-2 text-[10px] font-mono text-ink-500">
                Kitchen, counter & splashback
              </div>
            </div>
          </div>

          {/* Findings Panel with Reasoning */}
          <div>
            <ol className="border-t border-ink-200 divide-y divide-ink-200">
              <li className="py-5 lit">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs font-bold text-ink-900">01</span>
                  <h3 className="text-sm font-semibold text-ink-900">
                    Chipped laminate edge beside appliance recess
                  </h3>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-6 font-mono text-[10px]">
                  <span className="px-2 py-0.5 bg-damage-bg text-damage font-bold border border-damage-border">
                    DAMAGE
                  </span>
                  <span className="text-ink-500 uppercase">Moderate severity</span>
                  <span className="text-ink-500 uppercase">84% confidence</span>
                  <span className="px-2 py-0.5 bg-disputed-bg text-disputed font-bold border border-disputed-border">
                    DISPUTED
                  </span>
                </div>
                <p className="mt-2.5 pl-6 text-xs text-ink-600 leading-relaxed font-sans">
                  Worktop edge shows a lifted chip approximately 40 mm long. Tenant notes the appliance was pre-installed at move-in.
                </p>
              </li>

              <li className="py-5 lit">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs font-bold text-ink-900">02</span>
                  <h3 className="text-sm font-semibold text-ink-900">
                    Grout discolouration above counter
                  </h3>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-6 font-mono text-[10px]">
                  <span className="px-2 py-0.5 bg-wear-bg text-wear font-bold border border-wear-border">
                    NORMAL WEAR
                  </span>
                  <span className="text-ink-500 uppercase">Minor severity</span>
                  <span className="text-ink-500 uppercase">90% confidence</span>
                  <span className="px-2 py-0.5 bg-accepted-bg text-accepted font-bold border border-accepted-border">
                    ACCEPTED
                  </span>
                </div>
                <p className="mt-2.5 pl-6 text-xs text-ink-600 leading-relaxed font-sans">
                  Even darkening of grout lines consistent with routine kitchen use and steam.
                </p>
              </li>
            </ol>

            <Link
              href="/properties"
              className="mt-6 inline-flex min-h-11 items-center border border-ink-300 bg-surface px-5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-900 hover:border-ink-500 transition-colors btn-motion lit"
            >
              Open the comparison screen
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 03 — HOW INTACT WORKS (Five Stages)
          ========================================================================= */}
      <section className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8 border-b border-ink-200">
        <div className="flex items-baseline justify-between border-b border-ink-200 pb-4 mb-8">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-xs font-bold text-ink-900">03</span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-900">
              How Intact works
            </h2>
          </div>
          <span className="font-mono text-xs text-ink-600">Five stages</span>
        </div>

        <ol className="border-t border-ink-200 divide-y divide-ink-200">
          <li className="grid gap-2 px-3 py-6 sm:grid-cols-[6rem_minmax(0,16rem)_minmax(0,1fr)] sm:gap-8 sm:py-7 interactive-row lit">
            <span className="font-mono text-xs font-bold text-ink-900">01</span>
            <h3 className="text-base font-semibold text-ink-900">Create the property</h3>
            <p className="max-w-xl text-sm leading-relaxed text-ink-600 font-sans">
              Address, tenancy dates, and the list of areas you intend to photograph. The area list becomes the structure of the whole record.
            </p>
          </li>

          <li className="grid gap-2 px-3 py-6 sm:grid-cols-[6rem_minmax(0,16rem)_minmax(0,1fr)] sm:gap-8 sm:py-7 interactive-row lit">
            <span className="font-mono text-xs font-bold text-ink-900">02</span>
            <h3 className="text-base font-semibold text-ink-900">Record move-in</h3>
            <p className="max-w-xl text-sm leading-relaxed text-ink-600 font-sans">
              Photograph each area once. Every photo is stamped with its area number, date and time, so nothing is left loose in a camera roll.
            </p>
          </li>

          <li className="grid gap-2 px-3 py-6 sm:grid-cols-[6rem_minmax(0,16rem)_minmax(0,1fr)] sm:gap-8 sm:py-7 interactive-row lit">
            <span className="font-mono text-xs font-bold text-ink-900">03</span>
            <h3 className="text-base font-semibold text-ink-900">Record move-out</h3>
            <p className="max-w-xl text-sm leading-relaxed text-ink-600 font-sans">
              At the end of the tenancy you are shown the original photo of each area and asked for the matching one.
            </p>
          </li>

          <li className="grid gap-2 px-3 py-6 sm:grid-cols-[6rem_minmax(0,16rem)_minmax(0,1fr)] sm:gap-8 sm:py-7 interactive-row lit">
            <span className="font-mono text-xs font-bold text-ink-900">04</span>
            <h3 className="text-base font-semibold text-ink-900">Compare and review</h3>
            <p className="max-w-xl text-sm leading-relaxed text-ink-600 font-sans">
              Each difference is listed as a numbered finding: damage, normal wear, or unclear. You accept or dispute each one yourself.
            </p>
          </li>

          <li className="grid gap-2 px-3 py-6 sm:grid-cols-[6rem_minmax(0,16rem)_minmax(0,1fr)] sm:gap-8 sm:py-7 interactive-row lit bg-surface">
            <span className="font-mono text-xs font-bold text-accent">05</span>
            <h3 className="text-base font-semibold text-ink-900">Issue the report</h3>
            <p className="max-w-xl text-sm leading-relaxed text-ink-600 font-sans">
              A dated inspection report with the photo record attached, shareable as a read-only link.
            </p>
          </li>
        </ol>
      </section>

      {/* =========================================================================
          SECTION 04 — WHAT INTACT DOES NOT DO (Scope of the Record)
          ========================================================================= */}
      <section className="border-y border-ink-200 bg-page/60">
        <div className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8">
          <div className="flex items-baseline justify-between border-b border-ink-200 pb-4 mb-8">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-xs font-bold text-ink-900">04</span>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-900">
                What Intact does not do
              </h2>
            </div>
            <span className="font-mono text-xs text-ink-600">Scope of the record</span>
          </div>

          <div className="grid gap-x-12 sm:grid-cols-2">
            <div className="border-t border-ink-300 py-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-ink-900">
                Decide who pays
              </h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-600 font-sans">
                Intact records condition. It has no view on deposits, deductions or liability.
              </p>
            </div>

            <div className="border-t border-ink-300 py-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-ink-900">
                Contact your landlord
              </h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-600 font-sans">
                Nothing is sent anywhere. You choose when, and with whom, to share a report.
              </p>
            </div>

            <div className="border-t border-ink-300 py-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-ink-900">
                Score your property
              </h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-600 font-sans">
                There is no rating, no index and no benchmark. Only your own photographs.
              </p>
            </div>

            <div className="border-t border-ink-300 py-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-ink-900">
                Judge unclear evidence
              </h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-600 font-sans">
                Where the photographs cannot support a conclusion, the finding is marked UNCLEAR and left to you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          RECORD 05 — BEGIN (Final Action Callout)
          ========================================================================= */}
      <section className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8">
        <div className="border border-ink-300 bg-surface px-6 py-12 sm:px-12">
          <span className="font-mono text-xs uppercase tracking-wider text-ink-500 font-bold">
            Record 05 — Begin
          </span>
          <h2 className="mt-6 max-w-2xl text-2xl sm:text-3xl font-bold leading-tight text-ink-900">
            Twenty minutes with a phone camera today. A dated record you can rely on at the end of the tenancy.
          </h2>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex min-h-12 items-center border border-accent bg-accent px-6 font-mono text-xs uppercase tracking-[0.16em] text-white hover:bg-accent-hover transition-colors btn-motion lit-dark"
            >
              Start a move-in record
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center border border-ink-300 bg-page px-6 font-mono text-xs uppercase tracking-[0.16em] text-ink-900 hover:border-ink-500 transition-colors btn-motion lit"
            >
              I already have a record
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
