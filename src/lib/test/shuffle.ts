/**
 * Variantlarni qayta aralashtirish: har bir element avvalgi joyida qolmaydi
 * (2 tadan kam element bo'lsa — o'zgarishsiz). Javob berilmay tashlab ketilgan
 * savolga qaytilganda ishlatiladi — oldin "to'g'ri" deb o'ylangan javob
 * o'sha belgida (masalan F2) qolmasligi uchun.
 */
export function reshuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  if (items.length < 2) return [...items];
  for (let attempt = 0; attempt < 20; attempt++) {
    const next = [...items];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    if (next.every((item, i) => item !== items[i])) return next;
  }
  // Juda kam ehtimolli holat — bir qadam aylantiramiz (har biri boshqa joyda).
  return [...items.slice(1), items[0]];
}
