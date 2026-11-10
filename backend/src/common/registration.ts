// Ro'yxatdan o'tish qoidalari.

/** Oferta tahriri (frontend /oferta sahifasidagi "Oxirgi yangilanish" bilan bir xil). Rozilik bilan saqlanadi. */
export const OFFER_VERSION = "2026-11-09";

/**
 * Telefon SMS-kod bilan tasdiqlanadimi. Hozircha o'chiq: ro'yxatdan o'tish
 * SMS'siz (frontend: NEXT_PUBLIC_SMS_VERIFICATION_ENABLED). Yoqilganda telefon
 * tasdiqlash (Eskiz, alohida branch) shu flag orqali ulanadi.
 */
export function smsVerificationEnabled(): boolean {
  return process.env.SMS_VERIFICATION_ENABLED === "true";
}

/**
 * SMS tasdig'isiz suiiste'molga qarshi: bir IP'dan soatiga nechta yangi
 * ro'yxatdan o'tish (REGISTER_LIMIT_PER_IP_HOUR, standart 30). Juda past
 * qilinmasin: mobil operatorlarda ko'p foydalanuvchi bitta IP (CGNAT) ortida.
 */
export function registrationsPerIpPerHour(): number {
  const n = Number(process.env.REGISTER_LIMIT_PER_IP_HOUR);
  return Number.isInteger(n) && n > 0 ? n : 30;
}
