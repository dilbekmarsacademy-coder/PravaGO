// Admin panel: o'quvchi paroli. Parolni admin o'zi kiritadi; "Tasodifiy parol"
// tugmasi faqat maydonni to'ldiradi (brauzerda, crypto bilan) — serverga
// boshqa parol kabi yuboriladi. Qoidalar backend'dagi SetPasswordDto bilan bir xil.

export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 100;

// O'xshash belgilar (0/O/o, 1/l/I/i) yo'q — o'quvchiga aytish/yozish oson.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function randomPassword(length = 8): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Xato matni yoki null (to'g'ri). */
export function passwordError(password: string, confirm: string): string | null {
  if (password.length === 0) return "Parolni kiriting";
  if (/\s/.test(password)) return "Parolda bo'sh joy bo'lmasin";
  if (password.length < MIN_PASSWORD_LENGTH) return `Kamida ${MIN_PASSWORD_LENGTH} ta belgi`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Ko'pi bilan ${MAX_PASSWORD_LENGTH} ta belgi`;
  if (confirm !== password) return "Parollar mos emas";
  return null;
}
