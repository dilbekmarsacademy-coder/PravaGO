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
  /**
   * HTML'dagi so'z o'rtasidan boshlangan/tugagan belgilashni ("av<mark>tom</mark>obil")
   * kalit so'zni butun so'z sifatida qayta qidirib to'g'rilash. 1–2-kunlarda
   * o'chiq — ular manbadagidek import qilingan.
   */
  fixPartialMarks?: boolean;
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

// 3-kun: 1- va 2-mavzu docx'larida sarlavha faqat "3-кун N-мавзу" — mavzu fayl
// nomidan aniqlanadi. 1-mavzu uchun HTML yo'q: kalit so'zlar qo'lda tanlangan
// (content-source/day3/auto/day3-topic1.json, `source: "auto"`).
const DAY3: DayConfig = {
  day: 3,
  pairByNumber: false,
  fixPartialMarks: true,
  legacySlugs: {},
  topics: [
    {
      order: 1,
      slug: "day3-topic1",
      title: { uz: "Harakatlanishni boshlash, manyovr qilish", cyrl: "Ҳаракатланишни бошлаш, манёвр қилиш", ru: "Начало движения, маневрирование" },
      must: ["harakatlanishni boshlash"],
      files: { docx: "3-kun 1- mavzu Harakatlanishni boshlash, Manyovr qilish.docx", html: null },
    },
    {
      order: 2,
      slug: "day3-topic2",
      title: { uz: "Yuk tashish", cyrl: "Юк ташиш", ru: "Перевозка грузов" },
      must: ["yuk tashish"],
      files: { docx: "3-kun 2-mavzu Yuk tashish j.b.docx", html: "37-mavzu-yuk-tashish-universal-v2.html" },
    },
    {
      order: 3,
      slug: "day3-topic3",
      title: { uz: "Velosiped, moped va aravalar harakatlanishi", cyrl: "Велосипед, мопед ва аравалар ҳаракатланиши", ru: "Движение велосипедов, мопедов и гужевых повозок" },
      must: ["velosiped moped va aravalar"],
      files: {
        docx: "3_kun_3_mavzu_Велосипед,_мопед_ва_аравалар_ҳаракатланиши.docx",
        html: "38_mavzu_velosiped_moped_va_aravalar_harakatlanishi_universal_v2.html",
      },
    },
    {
      order: 4,
      slug: "day3-topic4",
      title: { uz: "Transport vositalaridan foydalanish", cyrl: "Транспорт воситаларидан фойдаланиш", ru: "Эксплуатация транспортных средств" },
      must: ["transport vositalaridan foydalanish"],
      files: { docx: "3-kun 4-mavzu — Transport vositalaridan foydalanish.docx", html: "40-mavzu-transport-vositalaridan-foydalanish-universal-v2.html" },
    },
    {
      order: 5,
      slug: "day3-topic5",
      title: { uz: "Harakat xavfsizligi asoslari", cyrl: "Ҳаракат хавфсизлиги асослари", ru: "Основы безопасности движения" },
      must: ["harakat xavfsizligi asoslari"],
      files: { docx: "3_kun_5_mavzu_Ҳаракат_хавфсизлиги_асослари.docx", html: "41-mavzu-harakat-xavfsizligi-asoslari-universal-v2.html" },
    },
    {
      order: 6,
      slug: "day3-topic6",
      title: { uz: "Birinchi tibbiy yordam", cyrl: "Биринчи тиббий ёрдам", ru: "Первая медицинская помощь" },
      must: ["birinchi tibbiy yordam"],
      files: { docx: "3-kun 6-mavzu Биринчи тиббий ёрдам.docx", html: "42-mavzu-birinchi-tibbiy-yordam-universal-v2.html" },
    },
  ],
};

// 4-kun: 5-mavzu uchun HTML yo'q (kalit so'zlar qo'lda — content-source/day4/auto/).
const DAY4: DayConfig = {
  day: 4,
  pairByNumber: false,
  fixPartialMarks: true,
  legacySlugs: {},
  topics: [
    {
      order: 1,
      slug: "day4-topic1",
      title: { uz: "Tik chiziqlar", cyrl: "Тик чизиқлар", ru: "Вертикальная разметка" },
      must: ["tik chiziqlar"],
      files: { docx: "4-kun 1-mavzu Тик чизиқлар.docx", html: "13-mavzu-tik-chiziqlar-android-iphone.html" },
    },
    {
      order: 2,
      slug: "day4-topic2",
      title: { uz: "Yotiq chiziqlar", cyrl: "Ётиқ чизиқлар", ru: "Горизонтальная разметка" },
      must: ["yotiq chiziqlar"],
      files: { docx: "4-kun 2-mavzu Ётиқ чизиқлар j.b.docx", html: "12-mavzu-yotiq-chiziqlar-universal-v2.html" },
    },
    {
      order: 3,
      slug: "day4-topic3",
      title: { uz: "Harakatlanish tezligi", cyrl: "Ҳаракатланиш тезлиги", ru: "Скорость движения" },
      must: ["harakatlanish tezligi"],
      files: { docx: "4-kun 3-mavzu Ҳаракатланиш тезлиги j.b.docx", html: "19-mavzu-harakatlanish-tezligi-universal-v2.html" },
    },
    {
      order: 4,
      slug: "day4-topic4",
      title: { uz: "To'xtash va to'xtab turish", cyrl: "Тўхташ ва тўхтаб туриш", ru: "Остановка и стоянка" },
      must: ["toxtash va toxtab turish"],
      files: { docx: "4-kun 4-mavzu Тўхташ ва тўхтаб туриш j.b.docx", html: "21-mavzu-toxtash-va-toxtab-turish-universal-v2.html" },
    },
    {
      order: 5,
      slug: "day4-topic5",
      title: { uz: "Tik balandlik va nishablikda harakatlanish", cyrl: "Тик баландлик ва нишабликда ҳаракатланиш", ru: "Движение на крутых подъёмах и спусках" },
      must: ["tik balandlik"],
      files: { docx: "4_kun_5_mavzu_Тик_баландлик_ва_нишабликда_ҳаракатланиш.docx", html: null },
    },
    {
      order: 6,
      slug: "day4-topic6",
      title: { uz: "Transport vositalarini boshqarishni o'rganish", cyrl: "Транспорт воситаларини бошқаришни ўрганиш", ru: "Учебная езда" },
      must: ["boshqarishni organish"],
      files: {
        docx: "4_kun_6_mavzu_Транспорт_воситаларини_бошқаришни_ўрганиш.docx",
        html: "35_mavzu_transport_vositalarini_boshqarishni_organish_universal.html",
      },
    },
    {
      order: 7,
      slug: "day4-topic7",
      title: {
        uz: "Mansabdor shaxslar va fuqarolarning yo'l harakati xavfsizligini ta'minlash",
        cyrl: "Мансабдор шахслар ва фуқароларнинг йўл ҳаракати хавфсизлигини таъминлаш",
        ru: "Обязанности должностных лиц и граждан по обеспечению безопасности дорожного движения",
      },
      must: ["mansabdor shaxs"],
      files: {
        docx: "4_kun_7_mavzu_Мансабдор_шахсларнинг_ва_фуқароларнинг_йўл_ҳаракат.docx",
        html: "39-mavzu-mansabdor-shaxslar-va-fuqarolar-universal-v2.html",
      },
    },
  ],
};

export const DAYS: Record<number, DayConfig> = { 1: DAY1, 2: DAY2, 3: DAY3, 4: DAY4 };
