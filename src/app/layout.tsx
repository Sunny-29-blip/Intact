import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "@/components/AppNav";

export const metadata: Metadata = {
  title: "Intact — Tenant Inspection Evidence Engine",
  description: "Tenancy move-in and move-out condition evidence and comparison engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper-50 text-ink-900 font-sans antialiased flex flex-col">
        <AppNav />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
