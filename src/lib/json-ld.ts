import { BUSINESS, INSTAGRAM_URL } from "@/config/business";
import type { Requisites } from "@/config/requisites.server";
import { BRAND_ALT_NAMES, BRAND_NAME, SITE_URL } from "@/lib/seo";

// Ommaviy sahifalar uchun JSON-LD. STIR faqat tekshirilgan (9 xonali) bo'lsa
// qo'shiladi — requisites.server.ts.

export function organizationLd(requisites: Pick<Requisites, "stir">) {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: BRAND_NAME,
    alternateName: [...BRAND_ALT_NAMES, BUSINESS.altBrandName],
    legalName: BUSINESS.sellerName,
    url: `${SITE_URL}/`,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 },
    email: BUSINESS.email,
    telephone: BUSINESS.phone.replace(/\s/g, ""),
    address: { "@type": "PostalAddress", streetAddress: BUSINESS.address, addressCountry: "UZ" },
    ...(requisites.stir ? { taxID: requisites.stir } : {}),
    sameAs: [BUSINESS.telegram, INSTAGRAM_URL, BUSINESS.youtube],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      telephone: BUSINESS.phone.replace(/\s/g, ""),
      email: BUSINESS.email,
      availableLanguage: ["uz", "ru"],
      hoursAvailable: { "@type": "OpeningHoursSpecification", opens: "09:00", closes: "23:00" },
    },
  };
}

/** `<script type="application/ld+json">` uchun xavfsiz matn (`<` qochiriladi). */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
