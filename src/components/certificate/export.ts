// Sertifikatni yuklab olish: PNG (html-to-image, faqat bosilganda yuklanadi)
// va chop etish / PDF (brauzerning chop etish oynasi, A4 landshaft).

import { CERT_HEIGHT, CERT_WIDTH } from "./Certificate";

/** 2x — 3200×2262 px (certificate-sample.png bilan bir xil o'lcham). */
const PNG_PIXEL_RATIO = 2;

export async function downloadCertificatePng(node: HTMLElement, certificateNumber: string): Promise<void> {
  const { toPng } = await import("html-to-image");
  await document.fonts.ready;
  const options = { width: CERT_WIDTH, height: CERT_HEIGHT, pixelRatio: PNG_PIXEL_RATIO, cacheBust: true, style: { transform: "none" } };
  // Birinchi chaqiruv shrift va rasmlarni keshga oladi (Safari'da birinchi kadr bo'sh chiqishi mumkin).
  await toPng(node, options).catch(() => undefined);
  const url = await toPng(node, options);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pravaishonch-sertifikat-${certificateNumber}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Chop etish: sahifada `#certificate-print-root` bo'lishi kerak (globals.css — @media print). */
export function printCertificate(): void {
  document.body.classList.add("printing-certificate");
  const done = () => {
    document.body.classList.remove("printing-certificate");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}
