// Feature flag'lar (.env, build vaqtida o'rnatiladi). Faqat aniq "true" yoqadi.

/** Onlayn to'lov (Payme, Click, keyinroq Uzum Bank) ulanganmi: "Sotib olish" tugmasi va to'lov logolari. */
export const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";

/** Bosh sahifadagi o'quvchilar fikrlari — haqiqiy sharhlar kelguncha yopiq. */
export const SHOW_TESTIMONIALS = process.env.NEXT_PUBLIC_SHOW_TESTIMONIALS === "true";
