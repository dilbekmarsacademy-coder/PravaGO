// Tariflar — saytdagi narxlarning yagona manbai (/tariflar, bosh sahifa
// "Tariflar" bo'limi, oferta, JSON-LD). To'lov integratsiyasi (keyingi bosqich)
// ham shundan oladi. Narx formati — faqat formatSom()/formatPrice().

export type TariffId = "standart" | "premium" | "mentor";

/** "fixed" — muddat kunlarda; "until_passed" — foydalanuvchi haydovchilik imtihonidan o'tguncha. */
export type AccessMode = "fixed" | "until_passed";

export interface TariffOption {
  /** so'm */
  price: number;
  /** null — "imtihondan o'tguncha". */
  durationDays: number | null;
  /** Muddat nomi: "1 hafta", "Imtihondan o'tguncha". */
  label: string;
}

export interface Tariff {
  id: TariffId;
  /** Ko'rsatish tartibi. */
  order: number;
  name: string;
  /** Qisqa tavsif (o'zbek lotin). */
  summary: string;
  accessMode: AccessMode;
  /** Narx/muddat variantlari; birinchisi — standart tanlov. */
  options: TariffOption[];
  /** Qaysi tariflarning imkoniyatlarini to'liq o'z ichiga oladi ("Standartdagi hamma narsa +"). */
  inherits: TariffId[];
  /** Faqat shu tarifga qo'shiladigan imkoniyatlar (o'zbek lotin). */
  features: string[];
  /** "Mashhur" belgisi. */
  popular?: boolean;
}

export const UNTIL_PASSED_LABEL = "Imtihondan o'tguncha";

const LIST: Tariff[] = [
  {
    id: "standart",
    order: 1,
    name: "Standart",
    summary: "Testlar bilan mustaqil tayyorgarlik",
    accessMode: "fixed",
    options: [
      { price: 25_000, durationDays: 7, label: "1 hafta" },
      { price: 48_000, durationDays: 14, label: "2 hafta" },
      { price: 75_000, durationDays: 30, label: "1 oy" },
    ],
    inherits: [],
    features: [
      "Yo'l harakati qoidalari bo'yicha testlar",
      "Barcha imtihon biletlari",
      "Mavzular bo'yicha test ishlash",
      "Imtihon rejimida bilimni sinash",
      "Noto'g'ri javoblarni qayta ishlash",
      "Test natijalarini kuzatish",
    ],
  },
  {
    id: "premium",
    order: 2,
    name: "Premium",
    summary: "Videodarslar va shaxsiy kurator bilan to'liq kurs",
    // TODO(admin): imtihondan o'tgach administrator akkauntni yopadi — backend amali keyingi bosqichda.
    accessMode: "until_passed",
    options: [{ price: 300_000, durationDays: null, label: UNTIL_PASSED_LABEL }],
    inherits: ["standart"],
    features: ["Barcha testlar", "Videodarslar", "Qoidalarni oson tushuntirish", "Testlarning videotahlili", "Shaxsiy kurator"],
    popular: true,
  },
  {
    id: "mentor",
    order: 3,
    name: "Mentor",
    summary: "Ustoz bilan 2 kunlik jonli dars",
    // TODO(admin): imtihondan o'tgach administrator akkauntni yopadi — backend amali keyingi bosqichda.
    accessMode: "until_passed",
    options: [{ price: 500_000, durationDays: null, label: UNTIL_PASSED_LABEL }],
    inherits: ["standart", "premium"],
    features: ["2 kun ustoz bilan jonli dars. Ustoz foydalanuvchi bilan ko'rishib, 2 kun davomida dars o'tib beradi."],
  },
];

/** Tariflar `order` bo'yicha. */
export const TARIFFS: Tariff[] = [...LIST].sort((a, b) => a.order - b.order);

export const TARIFF_RULES = {
  /** Bepul sinov muddati (kun). */
  trialDays: 1,
  /** Bitta akkaunt — nechta qurilma. */
  maxDevices: 1,
  /** Farqini to'lab yuqori tarifga o'tish — hozircha faqat flag, mantiq keyingi bosqichda. */
  allowUpgradeWithDifference: true,
} as const;

export function tariffById(id: TariffId): Tariff {
  return TARIFFS.find((t) => t.id === id)!;
}

/** "Standartdagi hamma narsa +" / "Standart va Premiumdagi hamma narsa +"; meros bo'lmasa null. */
export function inheritsLabel(t: Tariff): string | null {
  if (!t.inherits.length) return null;
  const names = t.inherits.map((id) => tariffById(id).name);
  return `${names.length > 1 ? `${names.slice(0, -1).join(", ")} va ${names.at(-1)}` : names[0]}dagi hamma narsa +`;
}

/** 25000 → "25 000" (oddiy probel — server va klientda bir xil). */
export function formatPrice(amount: number): string {
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** 25000 → "25 000 so'm" — saytdagi barcha narxlar shu bilan formatlanadi. */
export function formatSom(amount: number): string {
  return `${formatPrice(amount)} so'm`;
}

/** Eng arzon variant narxi (JSON-LD, tavsiflar). */
export function minPrice(t: Tariff): number {
  return Math.min(...t.options.map((o) => o.price));
}
