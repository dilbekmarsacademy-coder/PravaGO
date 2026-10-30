// Admin panelda tahrirlash uchun ochiq kurs kunlari (savollar, rasmlar,
// javoblar, kalit so'zlar, video). Cheklash kerak bo'lsa — env:
// ADMIN_EDITABLE_DAYS="5,6".
export const ADMIN_EDITABLE_DAYS: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

export function editableDays(): readonly number[] {
  const raw = process.env.ADMIN_EDITABLE_DAYS?.trim();
  if (!raw) return ADMIN_EDITABLE_DAYS;
  const days = raw
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d > 0);
  return days.length ? days : ADMIN_EDITABLE_DAYS;
}
