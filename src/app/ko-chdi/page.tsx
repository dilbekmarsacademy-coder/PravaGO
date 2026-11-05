import type { Metadata } from "next";
import { headers } from "next/headers";
import { MovedView } from "@/components/transfer/MovedView";
import { plainTarget, safeNextPath } from "@/lib/transfer";

// Eski manzil (pravatayyor.vercel.app) — proxy har qanday sahifani shu yerga
// rewrite qiladi; eski yo'l `x-moved-from` sarlavhasida keladi.
export const metadata: Metadata = {
  title: { absolute: "Sayt koʻchdi — PravaIshonch" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export default async function MovedPage() {
  const oldPath = safeNextPath((await headers()).get("x-moved-from"), "/");
  return (
    <>
      {/* JS o'chiq bo'lsa — 5 soniyadan keyin faqat oddiy sahifaga (kodsiz). */}
      <noscript>
        <meta httpEquiv="refresh" content={`5;url=${plainTarget(oldPath)}`} />
      </noscript>
      <MovedView oldPath={oldPath} />
    </>
  );
}
