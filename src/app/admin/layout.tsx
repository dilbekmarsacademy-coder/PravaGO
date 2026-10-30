import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Admin — PravaTayyor",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  // Brauzer tarjimasi (Chrome/Google Translate) DOM'dagi matnlarni o'zgartiradi
  // va React birinchi yangilanishda qulaydi — admin panelda oq ekran qolardi.
  other: { google: "notranslate" },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div lang="uz" translate="no" className="notranslate flex min-h-full flex-1 flex-col">{children}</div>;
}
