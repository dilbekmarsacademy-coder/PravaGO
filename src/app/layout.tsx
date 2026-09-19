import type { Metadata } from "next";
import { Syne, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

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
      className={`h-full ${syne.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
