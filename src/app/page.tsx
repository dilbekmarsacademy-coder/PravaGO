import type { Metadata } from "next";
import HomePage from "@/components/home/HomePage";
import SiteFooter from "@/components/legal/SiteFooter";
import { BRAND_ALT_NAMES, BRAND_NAME, SITE_DESCRIPTION, SITE_URL, SOCIAL_LINKS } from "@/lib/seo";

// Qidiruv tizimlari uchun tuzilgan ma'lumot: sayt nomi (variantlari bilan) va tashkilot logosi.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: BRAND_NAME,
      alternateName: BRAND_ALT_NAMES,
      url: `${SITE_URL}/`,
      inLanguage: ["uz", "ru"],
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: BRAND_NAME,
      alternateName: BRAND_ALT_NAMES,
      url: `${SITE_URL}/`,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 },
      image: `${SITE_URL}/og-image.png`,
      description: SITE_DESCRIPTION,
      ...(SOCIAL_LINKS.length ? { sameAs: SOCIAL_LINKS } : {}),
    },
  ],
};

// Canonical doim asosiy domen (metadataBase) — *.vercel.app nusxalari emas.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        // Faqat statik, o'zimizning ma'lumotlar; `<` qochiriladi.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
      />
      <HomePage footer={<SiteFooter />} />
    </>
  );
}
