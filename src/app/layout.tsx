import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/AppNav";
import { AppFooter } from "@/components/AppFooter";
import { AmbientLightTracker } from "@/components/AmbientLightTracker";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export const dynamic = "force-dynamic";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Intact — Move-In & Move-Out Inspection Record",
  description:
    "Tenant-side photo documentation and difference comparison engine for rental homes, hostels, and PGs.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let userEmail: string | null = null;
  let userRole: UserRole | null = null;
  let userIsDemo = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      userEmail = user.email || null;
      userIsDemo = Boolean(user.app_metadata?.is_demo);
      const adminSupabase = createAdminClient();
      const { data: profile } = await adminSupabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      userRole = (profile?.role as UserRole) || "tenant";
    }
  } catch (e) {
    console.error("Layout auth session retrieval error:", e);
  }

  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-screen bg-page text-ink-900 font-sans antialiased flex flex-col selection:bg-accent-tint selection:text-accent">
        <AmbientLightTracker />
        <AppNav
          initialUser={userEmail ? { email: userEmail } : null}
          initialRole={userRole}
          initialIsDemo={userIsDemo}
        />
        <div className="flex-1 flex flex-col">{children}</div>
        <AppFooter isAuthenticated={!!userEmail} userRole={userRole} />
      </body>
    </html>
  );
}
