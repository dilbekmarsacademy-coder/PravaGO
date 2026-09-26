import type { Metadata } from "next";
import { Syne, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
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

const syne = Syne({
  variable: "--font-syne",
  weight: ["600", "700", "800"],
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "latin-ext"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PravaTayyor — Haydovchilik imtihoniga tayyorgarlik",
  description:
    "Respublika miqyosidagi onlayn haydovchilik (prava) imtihoniga tayyorgarlik platformasi.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="uz"
      suppressHydrationWarning
      className={`h-full ${syne.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
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
