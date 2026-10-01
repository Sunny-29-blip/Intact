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
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      {/* Header Banner */}
      <div className="border border-ink-200 bg-white rounded p-8 sm:p-12 mb-10">
        <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-ink-500 mb-4">
          <span className="w-2 h-2 rounded-xs bg-accent inline-block"></span>
          <span>Tenancy Condition Protection System</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink-900 mb-4">
          Defend your rental deposit with indisputable photo evidence.
        </h1>

        <p className="text-base text-ink-600 max-w-2xl mb-8 leading-relaxed">
          Intact pairs and verifies condition photos taken at move-in and move-out.
          When you move out, visual differences are analyzed and classified to
          distinguish normal wear from tenant damage, producing an objective evidence
          record.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded transition-colors"
          >
            Create Your First Inspection Record
          </Link>
          <Link
            href="/login"
            className="px-5 py-2.5 bg-white border border-ink-200 hover:border-ink-400 text-ink-900 text-sm font-medium rounded transition-colors"
          >
            Sign In to Existing Record
          </Link>
        </div>
      </div>

      {/* 3-Step Procedure */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-ink-200 rounded p-6">
          <div className="text-xs font-mono text-ink-500 mb-2">STEP 01</div>
          <h2 className="text-base font-semibold text-ink-900 mb-2">
            Move-in Baseline
          </h2>
          <p className="text-xs text-ink-600 leading-relaxed">
            Photograph every area of the property on arrival. Photos are SHA-256
            hashed and safely archived with cryptographic timestamps.
          </p>
        </div>

        <div className="bg-white border border-ink-200 rounded p-6">
          <div className="text-xs font-mono text-ink-500 mb-2">STEP 02</div>
          <h2 className="text-base font-semibold text-ink-900 mb-2">
            Move-out Pairing
          </h2>
          <p className="text-xs text-ink-600 leading-relaxed">
            At departure, take photos matching your original move-in areas to form
            exact before-and-after comparison pairs.
          </p>
        </div>

        <div className="bg-white border border-ink-200 rounded p-6">
          <div className="text-xs font-mono text-ink-500 mb-2">STEP 03</div>
          <h2 className="text-base font-semibold text-ink-900 mb-2">
            Evidence Report
          </h2>
          <p className="text-xs text-ink-600 leading-relaxed">
            Generate an objective report classifying changes as wear vs. damage,
            ready to share with landlords via a secure link.
          </p>
        </div>
      </div>
    </main>
  );
}
