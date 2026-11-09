/** Mavzu testi "tugagan" deb hisoblanishi uchun kerakli eng kam foiz. */
export const PASS_PERCENT = 98;

/** Yakuniy imtihon uchun ruxsat etilgan maksimal urinishlar soni. */
export const FINAL_EXAM_MAX_ATTEMPTS = 10;

/**
 * Yakuniy imtihon oqimi yoqilgan (backend: /final-exam). Qulf qarori serverda —
 * 1–6-kun mavzulari tugatilmaguncha imtihon boshlanmaydi. Favqulodda holatda
 * kartani yopish uchun shu bayroqni false qilish kifoya.
 */
export const FINAL_EXAM_FLOW_ENABLED = true;

/** Test uchun har bir savolga beriladigan vaqt (soniya). */
export const TEST_TIME_PER_QUESTION_SEC = 60;

/** Test uchun vaqt chegarasi (soniya) — savollar soniga qarab: har biriga 1 daqiqa. */
export function testTimeLimitSec(questionCount: number): number {
  return Math.max(1, questionCount) * TEST_TIME_PER_QUESTION_SEC;
}

/** Vaqt tugaganda natija ko'rsatilgach kabinetga avtomatik o'tishgacha soniyalar. */
export const TIME_UP_REDIRECT_SEC = 5;

/** Imtihon rejimida o'tish uchun kerakli to'g'ri javoblar (20 tadan). */
export const EXAM_PASS_CORRECT = 18;
