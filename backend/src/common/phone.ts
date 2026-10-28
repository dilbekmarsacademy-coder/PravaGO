// Telefon raqamni yagona ko'rinishga keltirish: +998XXXXXXXXX.
// Qabul qilinadi: "+998 90 123 45 67", "998901234567", "901234567" va h.k.

const UZ_PHONE = /^\+998\d{9}$/;

export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 9) digits = `998${digits}`;
  const phone = `+${digits}`;
  return UZ_PHONE.test(phone) ? phone : null;
}
