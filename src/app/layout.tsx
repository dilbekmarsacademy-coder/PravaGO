import type { Metadata, Viewport } from "next";
import { Onest, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
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
  title: "PravaTayyor — Haydovchilik imtihoniga tayyorgarlik",
  description:
    "Respublika miqyosidagi onlayn haydovchilik (prava) imtihoniga tayyorgarlik platformasi.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // iPhone "home indicator" / chetlar uchun env(safe-area-inset-*) ishlashi uchun.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="uz"
      suppressHydrationWarning
      className={`h-full ${onest.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <Script id="locale-init" strategy="beforeInteractive">
          {LOCALE_INIT_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
