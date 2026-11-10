import type { Metadata, Viewport } from "next";
import { Onest, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import { Toaster } from "@/components/shared/Toast";
import AnalyticsTracker from "@/components/shared/AnalyticsTracker";
import CenterSessionWatcher from "@/components/shared/CenterSessionWatcher";
import ResetWatcher from "@/components/shared/ResetWatcher";
import { BRAND_DARK, BRAND_NAME, OG_IMAGE, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_TITLE, SITE_URL } from "@/lib/seo";
import "./globals.css";

const THEME_INIT_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem("theme");
    var isDark = stored === "light" ? false : true;
    if (isDark) document.documentElement.classList.add("dark");
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();`;

const LOCALE_INIT_SCRIPT = `(function () {
  var htmlLang = { "uz-latn": "uz", "uz-cyrl": "uz-Cyrl", ru: "ru" };
  try {
    var match = document.cookie.match(/(?:^|; )lang=([^;]+)/);
    var stored = match ? match[1] : localStorage.getItem("lang");
    var locale = stored === "uz-cyrl" || stored === "ru" ? stored : "uz-latn";
    document.documentElement.setAttribute("data-locale", locale);
    document.documentElement.lang = htmlLang[locale];
  } catch (e) {
    document.documentElement.setAttribute("data-locale", "uz-latn");
  }
})();`;

// Onest — kirill (o'zbek ў/қ/ғ/ҳ va rus) va lotinni to'liq qo'llaydi; butun
// sayt uchun yagona shrift (sarlavha ham, matn ham).
const onest = Onest({
  variable: "--font-onest",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s — ${BRAND_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: BRAND_NAME,
  keywords: SITE_KEYWORDS,
  // Google qidiruv natijasidagi ikonka: kvadrat, 48 ning karralisi, o'zgarmas URL (public/).
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: BRAND_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "uz_UZ",
    alternateLocale: ["ru_RU"],
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [OG_IMAGE] },
  // Brauzer tarjimasi (Chrome/Google Translate) DOM'dagi matnlarni o'zgartiradi
  // va React birinchi yangilanishda qulaydi — oq ekran. Sayt o'zi 3 tilda.
  other: { google: "notranslate" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // iPhone "home indicator" / chetlar uchun env(safe-area-inset-*) ishlashi uchun.
  viewportFit: "cover",
  themeColor: BRAND_DARK,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="uz"
      translate="no"
      suppressHydrationWarning
      className={`notranslate h-full ${onest.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <Script id="locale-init" strategy="beforeInteractive">
          {LOCALE_INIT_SCRIPT}
        </Script>
        <ResetWatcher />
        {children}
        <Toaster />
        <AnalyticsTracker />
        <CenterSessionWatcher />
      </body>
    </html>
  );
}
