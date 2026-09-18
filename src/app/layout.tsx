import type { Metadata } from "next";
import { Bebas_Neue, PT_Sans, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

const ptSans = PT_Sans({
  variable: "--font-pt-sans",
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  weight: ["400", "500", "700"],
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
      className={`h-full ${bebasNeue.variable} ${ptSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
