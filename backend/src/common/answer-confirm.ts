/**
 * Test javobini belgilaganda "Qabul qilaymi?" tasdiqlash panelini o'tkazib
 * yuboriladigan foydalanuvchilar ro'yxati.
 *
 * ANSWER_CONFIRM_SKIP_USERS — vergul bilan ajratilgan ro'yxat. O'rnatilmagan bo'lsa,
 * standart qiymat ishlatiladi; bo'sh qator ("") — hech kim (funksiya o'chiq).
 *
 * Solishtirish katta-kichik harfga va bo'shliqlarga e'tiborsiz. Element quyidagilardan
 * biriga mos kelsa yetarli:
 *  - login (markaz o'quvchisining yagona kirish identifikatori) — aniq, tavsiya etiladi;
 *  - to'liq ism: familiya+ism yoki ism+familiya (masalan "Muhammad Umar" → "muhammadumar").
 *    Ism yagona emas — bir xil ismli boshqa akkaunt ham ro'yxatga tushadi.
 */
export const DEFAULT_ANSWER_CONFIRM_SKIP_USERS = "MuhammadUmar";

export function normalizeSkipKey(raw: string): string {
  return raw.replace(/\s+/g, "").toLowerCase();
}

export function answerConfirmSkipList(raw: string | undefined = process.env.ANSWER_CONFIRM_SKIP_USERS): Set<string> {
  const value = raw ?? DEFAULT_ANSWER_CONFIRM_SKIP_USERS;
  return new Set(value.split(",").map(normalizeSkipKey).filter(Boolean));
}

export interface SkipCandidate {
  login: string | null;
  firstName: string | null;
  lastName: string | null;
}

export function skipsAnswerConfirm(user: SkipCandidate, list: Set<string> = answerConfirmSkipList()): boolean {
  if (list.size === 0) return false;
  const keys: string[] = [];
  if (user.login) keys.push(user.login);
  const first = user.firstName?.trim() ?? "";
  const last = user.lastName?.trim() ?? "";
  if (first && last) keys.push(last + first, first + last);
  return keys.some((k) => {
    const key = normalizeSkipKey(k);
    return key !== "" && list.has(key);
  });
}
