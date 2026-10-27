import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — ARCHED design",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-bg text-ink">{children}</div>;
}
