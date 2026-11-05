import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { SITE_URL } from "@/lib/seo";

/** Shaxsiy bo'limlar — qidiruvga yopiq (sahifalarning o'zida ham noindex). */
const PRIVATE_PATHS = ["/admin", "/kabinet", "/test", "/tolov", "/api", "/auth", "/ko-chdi"];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") ?? "";
  // pravatayyor.vercel.app va preview manzillari — butunlay yopiq; faqat asosiy domen indekslanadi.
  if (host.endsWith(".vercel.app")) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS.flatMap((p) => [p, `${p}/`]) },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
