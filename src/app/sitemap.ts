import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Faqat ommaviy sahifalar. Tariflar, dastur va "Biz haqimizda" — bosh sahifa
// bo'limlari (#narxlar ...), alohida URL emas. Kabinet, test, to'lov va admin
// shaxsiy (noindex).
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 }];
}
