import type { MetadataRoute } from "next";
import { BRAND_DARK, BRAND_NAME, SITE_DESCRIPTION } from "@/lib/seo";

/** PWA manifest (/manifest.webmanifest): nom, ikonkalar va brend ranglari. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: BRAND_DARK,
    theme_color: BRAND_DARK,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
