import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Admin — PravaTayyor",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div lang="uz" className="flex min-h-full flex-1 flex-col">{children}</div>;
}
