import type { Metadata } from "next";
import type { ReactNode } from "react";

// Shaxsiy bo'lim — qidiruv tizimlarida ko'rinmaydi (robots.ts'da ham yopiq).
export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function PrivateLayout({ children }: { children: ReactNode }) {
  return children;
}
