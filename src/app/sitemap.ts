import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Faqat ommaviy sahifalar: bosh sahifa, tariflar va hujjatlar (oferta,
// qaytarish, maxfiylik, aloqa). Kabinet, test, to'lov va admin shaxsiy (noindex).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/tariflar`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/oferta`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/qaytarish`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/maxfiylik`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/aloqa`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
