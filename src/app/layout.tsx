import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/AppNav";
import { AmbientLightTracker } from "@/components/AmbientLightTracker";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-screen bg-page text-ink-900 font-sans antialiased flex flex-col selection:bg-accent-tint selection:text-accent">
        <AmbientLightTracker />
        <AppNav />
        <div className="flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  );
}
