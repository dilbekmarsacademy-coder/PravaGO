// Har bir kun uchun import sozlamalari: mavzular, fayllar va ularni sarlavha
// bo'yicha aniqlash qoidalari. Yangi kun qo'shish — shu yerga yozuv qo'shish.

export interface TopicDef {
  order: number;
  slug: string;
  /** Sayt sarlavhasi (src/data/curriculum.ts bilan bir xil). */
  title: { uz: string; cyrl: string; ru: string };
  /** Fayl sarlavhasida (transliteratsiya + normallashtirishdan keyin) bo'lishi shart bo'lgan bo'laklar. */
  must: string[];
  mustNot?: string[];
  /**
   * Kutilgan fayl nomlari (berilgan bo'lsa, sarlavha bo'yicha topilgan fayl
   * bilan solishtiriladi — ikkalasi mos kelmasa import to'xtaydi).
   * `html: null` — bu mavzu uchun kalit so'z fayli yo'q.
   */
  files?: { docx: string; html: string | null };
}

export interface DayConfig {
  day: number;
  topics: TopicDef[];
  /**
   * HTML kartochkalarini `data-num` bo'yicha docx savoli bilan bog'lash (matn
   * o'xshashligi bilan tasdiqlanadi). 1-kunda raqamlar docx bilan mos emas
   * edi — u yerda faqat matn bo'yicha bog'lanadi.
   */
  pairByNumber: boolean;
  /** Eski (oldingi import) banklar — dublikat yaratmasdan shu mavzuga ko'chiriladi. */
  legacySlugs: Record<string, string>;
}

const DAY1: DayConfig = {
  day: 1,
  pairByNumber: false,
  legacySlugs: { "day1-topic2": "1-kun-2-mavzu-tartibga-soluvchining-ishoralari" },
  topics: [
    {
      order: 1,
      slug: "day1-topic1",
      title: { uz: "Svetofor ishoralari", cyrl: "Светофор ишоралари", ru: "Сигналы светофора" },
      must: ["svetofor ishoralari"],
    },
    {
      order: 2,
      slug: "day1-topic2",
      title: { uz: "Tartibga soluvchining ishoralari", cyrl: "Тартибга солувчининг ишоралари", ru: "Сигналы регулировщика" },
      must: ["tartibga soluvchining ishoralari"],
    },
    {
      order: 3,
      slug: "day1-topic3",
      title: { uz: "Chorrahalarda harakatlanish", cyrl: "Чорраҳаларда ҳаракатланиш", ru: "Движение через перекрёстки" },
      must: ["chorrahalarda harakatlanish"],
    },
    {
      order: 4,
      slug: "day1-topic4",
      title: { uz: "Tartibga solingan chorrahalar", cyrl: "Тартибга солинган чорраҳалар", ru: "Регулируемые перекрёстки" },
      must: ["tartibga solingan chorrahalar"],
    },
    {
      order: 5,
      slug: "day1-topic5",
      title: {
        uz: "Tartibga solinmagan chorrahalar: teng ahamiyatli yo'llar",
        cyrl: "Тартибга солинмаган чорраҳалар: тенг аҳамиятли йўллар",
        ru: "Нерегулируемые перекрёстки: равнозначные дороги",
      },
      must: ["tartibga solinmagan chorrahalar", "teng ahamiyatli"],
    },
    {
      order: 6,
      slug: "day1-topic6",
      title: {
        uz: "Tartibga solinmagan chorrahalar: asosiy yo'l yo'nalishi o'zgarishi",
        cyrl: "Тартибга солинмаган чорраҳалар: асосий йўл йўналиши ўзгариши",
        ru: "Нерегулируемые перекрёстки: изменение направления главной дороги",
      },
      must: ["tartibga solinmagan chorrahalar", "asosiy yol yonalishi", "ozgarishi"],
      mustNot: ["togrisi"],
    },
    {
      order: 7,
      slug: "day1-topic7",
      title: {
        uz: "Tartibga solinmagan chorrahalar: asosiy yo'l yo'nalishi o'zgarishi to'g'risi",
        cyrl: "Тартибга солинмаган чорраҳалар: асосий йўл йўналиши ўзгариши тўғриси",
        ru: "Нерегулируемые перекрёстки: изменение направления главной дороги (продолжение)",
      },
      must: ["tartibga solinmagan chorrahalar", "asosiy yol yonalishi", "togrisi"],
    },
  ],
};

// HTML fayllardagi "mavzu" raqami 2-kun mavzu raqamiga mos emas — bog'lash
// sarlavha bo'yicha, fayl nomlari esa qo'shimcha tasdiq.
const DAY2: DayConfig = {
  day: 2,
  pairByNumber: true,
  legacySlugs: {},
  topics: [
    {
      order: 1,
      slug: "day2-topic1",
      title: { uz: "Ogohlantiruvchi belgilar", cyrl: "Огоҳлантирувчи белгилар", ru: "Предупреждающие знаки" },
      must: ["ogohlantiruvchi belgilar"],
      files: { docx: "2-kun_1-mavzu_Ogohlantiruvchi_belgilar.docx", html: "5-mavzu-ogohlantiruvchi-belgilar-universal-v2.html" },
    },
    {
      order: 2,
      slug: "day2-topic2",
      title: { uz: "Imtiyoz belgilari", cyrl: "Имтиёз белгилари", ru: "Знаки приоритета" },
      must: ["imtiyoz belgilar"],
      files: { docx: "2-kun_2-mavzu_Imtiyoz_belgilari.docx", html: "6-mavzu-imtiyoz-belgilar-universal-v2.html" },
    },
    {
      order: 3,
      slug: "day2-topic3",
      title: { uz: "Ta'qiqlovchi belgilar", cyrl: "Тақиқловчи белгилар", ru: "Запрещающие знаки" },
      must: ["taqiqlovchi belgilar"],
      files: { docx: "2-kun_3-mavzu_Taqiqlovchi_belgilar.docx", html: "7-mavzu-taqiqlovchi-belgilar-universal-v2-63-savol.html" },
    },
    {
      order: 4,
      slug: "day2-topic4",
      title: { uz: "Buyuruvchi belgilar", cyrl: "Буюрувчи белгилар", ru: "Предписывающие знаки" },
      must: ["buyuruvchi belgilar"],
      files: { docx: "2-kun_4-mavzu_Buyuruvchi_belgilar.docx", html: "8-mavzu-buyuruvchi-belgilar-universal-v2.html" },
    },
    {
      order: 5,
      slug: "day2-topic5",
      title: { uz: "Axborot-ko'rsatkich belgilar", cyrl: "Ахборот-кўрсаткич белгилар", ru: "Информационно-указательные знаки" },
      must: ["axborot korsatkich"],
      files: {
        docx: "2-kun_5-mavzu_Axborot-korsatkich_belgilari.docx",
        html: "9-mavzu-axborot-korsatkich-belgilari-universal-v2-62-savol.html",
      },
    },
    {
      order: 6,
      slug: "day2-topic6",
      title: { uz: "Servis belgilari", cyrl: "Сервис белгилари", ru: "Знаки сервиса" },
      must: ["servis belgilari"],
      files: { docx: "2-kun_6-mavzu_Servis_belgilari.docx", html: null },
    },
    {
      order: 7,
      slug: "day2-topic7",
      title: { uz: "Qo'shimcha axborot belgilari", cyrl: "Қўшимча ахборот белгилари", ru: "Знаки дополнительной информации" },
      must: ["qoshimcha axborot"],
      files: { docx: "2-kun_7-mavzu_Qoshimcha_axborot_belgilari.docx", html: "11-mavzu-qoshimcha-axborot-belgilari-universal-v2.html" },
    },
  ],
};

export const DAYS: Record<number, DayConfig> = { 1: DAY1, 2: DAY2 };
