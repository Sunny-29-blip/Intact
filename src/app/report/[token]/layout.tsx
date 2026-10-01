import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared condition report · Intact",
  robots: { index: false, follow: false },
};

export default function SharedReportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
