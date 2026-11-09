import { Lora, Poppins } from "next/font/google";

// Sertifikat va xat shriftlari (certificate-sample.png dizayni): sarlavha va
// urg'u — Poppins 600/700, ism va oddiy matn — Lora (ism kursivda). Faqat
// sertifikat/xat komponentlari yuklanganda (dynamic import) qo'shiladi.
export const poppins = Poppins({
  variable: "--font-cert-poppins",
  weight: ["600", "700"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const lora = Lora({
  variable: "--font-cert-lora",
  weight: ["400", "500", "700"],
  style: ["normal", "italic"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const certificateFonts = `${poppins.variable} ${lora.variable}`;
