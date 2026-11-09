// Sotuvchi (YaTT) va aloqa ma'lumotlari — ommaviy sahifalar, footer va JSON-LD
// shu yerdan oladi. Bank rekvizitlari (STIR, MFO, hisob raqam) .env'da va faqat
// serverda o'qiladi: src/config/requisites.server.ts.

export const BUSINESS = {
  sellerName: "YaTT Bobojonov Ozodjon G'olibjon o'g'li",
  brandName: "PravaIshonch",
  /** Sayt shu nom bilan ham tanilgan. */
  altBrandName: "Haydovchilar akademiyasi",
  bankName: "Kapital Bank",
  address: "Toshkent viloyati, Piskent tumani, Piskent shahri, Istiqbol-1",
  phone: "+998 99 337 64 47",
  email: "muhammadumargolibjon4@gmail.com",
  telegram: "https://t.me/Akademiya_haydovchilar",
  instagram: "@haydovchilar_akademiyasi",
  youtube: "https://youtube.com/@muhammadumargolibjon-w4d",
  workingHours: "09:00–23:00",
  taxRegime: "Aylanmadan olinadigan soliq to'lovchisi (QQS to'lovchisi emas)",
  serviceDescription: "Onlayn ta'lim xizmati (haydovchilik imtihoniga tayyorgarlik)",
  /** IKPU (MXIK) — faqat ichki foydalanish (to'lov tizimi cheklari), sahifalarda ko'rsatilmaydi. */
  ikpuCode: "10899002001000000",
  minAge: 16,
} as const;

/** "+998 99 337 64 47" → "tel:+998993376447" */
export const PHONE_HREF = `tel:${BUSINESS.phone.replace(/\s/g, "")}`;
export const EMAIL_HREF = `mailto:${BUSINESS.email}`;
export const INSTAGRAM_URL = `https://instagram.com/${BUSINESS.instagram.replace(/^@/, "")}`;
/** "@Akademiya_haydovchilar" — havola matni uchun. */
export const TELEGRAM_HANDLE = `@${BUSINESS.telegram.split("/").pop()}`;
