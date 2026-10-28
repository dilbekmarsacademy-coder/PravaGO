// Admin panelda tahrirlash uchun ochiq kurs kunlari. Boshqa kunni ochish —
// shu ro'yxatga qo'shish (yoki env: ADMIN_EDITABLE_DAYS="5,6").
export const ADMIN_EDITABLE_DAYS: readonly number[] = [6];

export function editableDays(): readonly number[] {
  const raw = process.env.ADMIN_EDITABLE_DAYS?.trim();
  if (!raw) return ADMIN_EDITABLE_DAYS;
  const days = raw
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d > 0);
  return days.length ? days : ADMIN_EDITABLE_DAYS;
}
