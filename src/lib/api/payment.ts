// Mock to'lov API. Backend tayyor bo'lgach, shu fayldagi funksiyalarni haqiqiy
// fetch/so'rovlar bilan almashtirish kifoya — chaqiruvchi komponentlar
// o'zgarishsiz qoladi.

export type HostedPaymentMethod = "click" | "payme" | "uzum";
export type PaymentMethod = HostedPaymentMethod | "card";

export interface ChargeResult {
  success: boolean;
}

const NETWORK_DELAY_MS = 2000;
// Real to'lov provayderi vaqti-vaqti bilan rad etishi mumkin — buni
// demo/test maqsadida simulyatsiya qilamiz.
const MOCK_FAILURE_RATE = 0.15;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomOutcome(): boolean {
  return Math.random() > MOCK_FAILURE_RATE;
}

/**
 * Click / Payme / Uzum Bank kabi hosted-checkout provayderlar uchun mock.
 *
 * Haqiqiy versiyada bu funksiya o'rniga foydalanuvchi provayderning hosted
 * checkout sahifasiga redirect qilinadi (masalan `window.location.href = url`)
 * va akkaunt FAQAT provayderdan keladigan server-side webhook orqali
 * faollashtiriladi — bu yerdagi klient natijasi faqat UI holatini ko'rsatish
 * uchun ishlatiladi.
 */
export async function redirectToHostedCheckout(
  method: HostedPaymentMethod,
  amount: number,
): Promise<ChargeResult> {
  void method;
  void amount;
  await delay(NETWORK_DELAY_MS);
  return { success: randomOutcome() };
}

export interface CardDetails {
  numberDigits: string;
  expiry: string;
  holderName?: string;
}

/**
 * Karta ma'lumotlarini provayderga yuboradi (mock) va SMS-tasdiqlash
 * talab qilinishini qaytaradi. Karta raqami/muddati funksiyadan tashqarida
 * hech qayerda (localStorage, cookie, log) saqlanmaydi.
 */
export async function submitCardDetails(card: CardDetails): Promise<{ otpRequired: true }> {
  void card;
  await delay(900);
  return { otpRequired: true };
}

// TODO: keyinchalik real SMS backend integratsiyasi bilan almashtiriladi.
const DEV_MOCK_OTP_CODE = "dilbek12345";

export async function verifyCardOtp(code: string): Promise<{ valid: boolean }> {
  await delay(900);
  return { valid: code === DEV_MOCK_OTP_CODE };
}

/** SMS-kod tasdiqlangandan so'ng haqiqiy hisobdan yechish (mock). */
export async function chargeCard(): Promise<ChargeResult> {
  await delay(1200);
  return { success: randomOutcome() };
}
