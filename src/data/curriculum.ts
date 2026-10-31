// "6+1 kunlik dastur" — o'quv dasturining asosiy manbai. Kun ichidagi
// mavzular tartibi AYNAN shu ro'yxat bo'yicha (testNo bo'yicha saralanmaydi).
// `testNo` — rasmiy test raqami, test banki shu raqamga bog'lanadi.
//
// `id` — mavzuning barqaror ID'si (masalan "day1-topic1"); berilmasa
// `topic-<testNo>`. Video va test banki shu ID'ga ulanadi.
//
// `testSlug` — backend test bankidagi mavzu slug'i; mavjud bo'lsa mavzuni
// bosganda to'g'ridan-to'g'ri test boshlanadi.
//
// `lessonId` — video dars (backend/src/lessons/lessons.config.ts dagi kalit).
// Mavjud bo'lsa mavzu sahifasida video ko'rsatiladi va test video oxirigacha
// ko'rilmaguncha qulflanadi. Video manbai bu yerda EMAS — faqat serverda.
//
// Video ID'si bu yerda yo'q: `lessonId` ga mos video backend xaritasida
// bo'lmasa (masalan day1-topic7), mavzu sahifasida "video hali olinmagan"
// holat-ekrani chiqadi — video qo'shish uchun faqat backend'ga bitta qator.
//
// Ikkalasi ham bo'lmagan mavzu "Tez orada" holatida ko'rinadi va keyingi
// mavzularni qulflamaydi. Yangi mavzuga video/test qo'shish: README.md →
// "Yangi mavzuga video va test qo'shish".
//
// `questionCount` hozircha shu yerdan olinadi; savollar banki to'liq import
// qilingach, u DB'dan hisoblanadi va bu raqamlar faqat tekshiruv uchun qoladi.
// 1–6-kun test banklari backend'da (`npm run import:day1` … `import:day6`).
// 4-kun 1- va 5-mavzu docx'larida to'g'ri javob belgilanmagan — savollar import
// qilinmagan, shuning uchun ularda hozircha `testSlug` yo'q (faqat video).

import type { LocalizedText } from "@/lib/i18n/localized";
import type { Day, Topic } from "@/lib/course-types";

export interface CurriculumTopic {
  id?: string;
  testNo: number | null;
  testSlug?: string;
  lessonId?: string;
  questionCount: number;
  title: Required<LocalizedText>;
}

export interface CurriculumDay {
  day: number;
  isFinalExam?: boolean;
  topics: CurriculumTopic[];
}

export const CURRICULUM: CurriculumDay[] = [
  { day: 1, topics: [
    { id: "day1-topic1", lessonId: "day1-topic1", testSlug: "day1-topic1", testNo: 14, questionCount: 38, title: { uz: "Svetofor ishoralari", cyrl: "Светофор ишоралари", ru: "Сигналы светофора" } },
    { id: "day1-topic2", lessonId: "day1-topic2", testSlug: "day1-topic2", testNo: 15, questionCount: 32, title: { uz: "Tartibga soluvchining ishoralari", cyrl: "Тартибга солувчининг ишоралари", ru: "Сигналы регулировщика" } },
    { id: "day1-topic3", lessonId: "day1-topic3", testSlug: "day1-topic3", testNo: 22, questionCount: 14, title: { uz: "Chorrahalarda harakatlanish", cyrl: "Чорраҳаларда ҳаракатланиш", ru: "Движение через перекрёстки" } },
    { id: "day1-topic4", lessonId: "day1-topic4", testSlug: "day1-topic4", testNo: 23, questionCount: 21, title: { uz: "Tartibga solingan chorrahalar", cyrl: "Тартибга солинган чорраҳалар", ru: "Регулируемые перекрёстки" } },
    { id: "day1-topic5", lessonId: "day1-topic5", testSlug: "day1-topic5", testNo: 25, questionCount: 49, title: { uz: "Tartibga solinmagan chorrahalar: teng ahamiyatli yo'llar", cyrl: "Тартибга солинмаган чорраҳалар: тенг аҳамиятли йўллар", ru: "Нерегулируемые перекрёстки: равнозначные дороги" } },
    { id: "day1-topic6", lessonId: "day1-topic6", testSlug: "day1-topic6", testNo: 26, questionCount: 31, title: { uz: "Tartibga solinmagan chorrahalar: asosiy yo'l yo'nalishi o'zgarishi", cyrl: "Тартибга солинмаган чорраҳалар: асосий йўл йўналиши ўзгариши", ru: "Нерегулируемые перекрёстки: изменение направления главной дороги" } },
    { id: "day1-topic7", lessonId: "day1-topic7", testSlug: "day1-topic7", testNo: 24, questionCount: 19, title: { uz: "Tartibga solinmagan chorrahalar: asosiy yo'l yo'nalishi o'zgarishi to'g'risi", cyrl: "Тартибга солинмаган чорраҳалар: асосий йўл йўналиши ўзгариши тўғриси", ru: "Нерегулируемые перекрёстки: изменение направления главной дороги (продолжение)" } },
  ]},
  { day: 2, topics: [
    { id: "day2-topic1", lessonId: "day2-topic1", testSlug: "day2-topic1", testNo: 5, questionCount: 37, title: { uz: "Ogohlantiruvchi belgilar", cyrl: "Огоҳлантирувчи белгилар", ru: "Предупреждающие знаки" } },
    { id: "day2-topic2", lessonId: "day2-topic2", testSlug: "day2-topic2", testNo: 6, questionCount: 19, title: { uz: "Imtiyoz belgilari", cyrl: "Имтиёз белгилари", ru: "Знаки приоритета" } },
    { id: "day2-topic3", lessonId: "day2-topic3", testSlug: "day2-topic3", testNo: 7, questionCount: 63, title: { uz: "Ta'qiqlovchi belgilar", cyrl: "Тақиқловчи белгилар", ru: "Запрещающие знаки" } },
    { id: "day2-topic4", lessonId: "day2-topic4", testSlug: "day2-topic4", testNo: 8, questionCount: 31, title: { uz: "Buyuruvchi belgilar", cyrl: "Буюрувчи белгилар", ru: "Предписывающие знаки" } },
    { id: "day2-topic5", lessonId: "day2-topic5", testSlug: "day2-topic5", testNo: 9, questionCount: 62, title: { uz: "Axborot-ko'rsatkich belgilar", cyrl: "Ахборот-кўрсаткич белгилар", ru: "Информационно-указательные знаки" } },
    { id: "day2-topic6", lessonId: "day2-topic6", testSlug: "day2-topic6", testNo: 10, questionCount: 1, title: { uz: "Servis belgilari", cyrl: "Сервис белгилари", ru: "Знаки сервиса" } },
    { id: "day2-topic7", lessonId: "day2-topic7", testSlug: "day2-topic7", testNo: 11, questionCount: 38, title: { uz: "Qo'shimcha axborot belgilari", cyrl: "Қўшимча ахборот белгилари", ru: "Знаки дополнительной информации" } },
  ]},
  { day: 3, topics: [
    { id: "day3-topic1", lessonId: "day3-topic1", testSlug: "day3-topic1", testNo: 17, questionCount: 58, title: { uz: "Harakatlanishni boshlash, manyovr qilish", cyrl: "Ҳаракатланишни бошлаш, манёвр қилиш", ru: "Начало движения, маневрирование" } },
    { id: "day3-topic2", lessonId: "day3-topic2", testSlug: "day3-topic2", testNo: 37, questionCount: 17, title: { uz: "Yuk tashish", cyrl: "Юк ташиш", ru: "Перевозка грузов" } },
    { id: "day3-topic3", lessonId: "day3-topic3", testSlug: "day3-topic3", testNo: 38, questionCount: 13, title: { uz: "Velosiped, moped va aravalar harakatlanishi", cyrl: "Велосипед, мопед ва аравалар ҳаракатланиши", ru: "Движение велосипедов, мопедов и гужевых повозок" } },
    { id: "day3-topic4", lessonId: "day3-topic4", testSlug: "day3-topic4", testNo: 40, questionCount: 46, title: { uz: "Transport vositalaridan foydalanish", cyrl: "Транспорт воситаларидан фойдаланиш", ru: "Эксплуатация транспортных средств" } },
    { id: "day3-topic5", lessonId: "day3-topic5", testSlug: "day3-topic5", testNo: 41, questionCount: 71, title: { uz: "Harakat xavfsizligi asoslari", cyrl: "Ҳаракат хавфсизлиги асослари", ru: "Основы безопасности движения" } },
    { id: "day3-topic6", lessonId: "day3-topic6", testSlug: "day3-topic6", testNo: 42, questionCount: 34, title: { uz: "Birinchi tibbiy yordam", cyrl: "Биринчи тиббий ёрдам", ru: "Первая медицинская помощь" } },
  ]},
  { day: 4, topics: [
    { id: "day4-topic1", lessonId: "day4-topic1", testNo: 13, questionCount: 5, title: { uz: "Tik chiziqlar", cyrl: "Тик чизиқлар", ru: "Вертикальная разметка" } },
    { id: "day4-topic2", lessonId: "day4-topic2", testSlug: "day4-topic2", testNo: 12, questionCount: 74, title: { uz: "Yotiq chiziqlar", cyrl: "Ётиқ чизиқлар", ru: "Горизонтальная разметка" } },
    { id: "day4-topic3", lessonId: "day4-topic3", testSlug: "day4-topic3", testNo: 19, questionCount: 36, title: { uz: "Harakatlanish tezligi", cyrl: "Ҳаракатланиш тезлиги", ru: "Скорость движения" } },
    { id: "day4-topic4", lessonId: "day4-topic4", testSlug: "day4-topic4", testNo: 21, questionCount: 73, title: { uz: "To'xtash va to'xtab turish", cyrl: "Тўхташ ва тўхтаб туриш", ru: "Остановка и стоянка" } },
    { id: "day4-topic5", lessonId: "day4-topic5", testNo: 31, questionCount: 3, title: { uz: "Tik balandlik va nishablikda harakatlanish", cyrl: "Тик баландлик ва нишабликда ҳаракатланиш", ru: "Движение на крутых подъёмах и спусках" } },
    { id: "day4-topic6", lessonId: "day4-topic6", testSlug: "day4-topic6", testNo: 35, questionCount: 7, title: { uz: "Transport vositalarini boshqarishni o'rganish", cyrl: "Транспорт воситаларини бошқаришни ўрганиш", ru: "Учебная езда" } },
    { id: "day4-topic7", lessonId: "day4-topic7", testSlug: "day4-topic7", testNo: 39, questionCount: 14, title: { uz: "Mansabdor shaxslar va fuqarolarning yo'l harakati xavfsizligini ta'minlash", cyrl: "Мансабдор шахслар ва фуқароларнинг йўл ҳаракати хавфсизлигини таъминлаш", ru: "Обязанности должностных лиц и граждан по обеспечению безопасности дорожного движения" } },
  ]},
  { day: 5, topics: [
    { id: "day5-topic1", lessonId: "day5-topic1", testSlug: "day5-topic1", testNo: 1, questionCount: 52, title: { uz: "Umumiy qoidalar", cyrl: "Умумий қоидалар", ru: "Общие положения" } },
    { id: "day5-topic2", lessonId: "day5-topic2", testSlug: "day5-topic2", testNo: 18, questionCount: 45, title: { uz: "Yo'lning qatnov qismida transport vositalarining joylashuvi", cyrl: "Йўлнинг қатнов қисмида транспорт воситаларининг жойлашуви", ru: "Расположение транспортных средств на проезжей части" } },
    { id: "day5-topic3", lessonId: "day5-topic3", testSlug: "day5-topic3", testNo: 20, questionCount: 35, title: { uz: "Quvib o'tish", cyrl: "Қувиб ўтиш", ru: "Обгон" } },
    { id: "day5-topic4", lessonId: "day5-topic4", testSlug: "day5-topic4", testNo: 28, questionCount: 18, title: { uz: "Temir yo'l kesishmalari orqali harakatlanish", cyrl: "Темир йўл кесишмалари орқали ҳаракатланиш", ru: "Движение через железнодорожные переезды" } },
    { id: "day5-topic5", lessonId: "day5-topic5", testSlug: "day5-topic5", testNo: 29, questionCount: 15, title: { uz: "Avtomagistralda harakatlanish", cyrl: "Автомагистралда ҳаракатланиш", ru: "Движение по автомагистралям" } },
    { id: "day5-topic6", lessonId: "day5-topic6", testSlug: "day5-topic6", testNo: 30, questionCount: 9, title: { uz: "Turar joy dahalarida harakatlanish", cyrl: "Турар жой даҳаларида ҳаракатланиш", ru: "Движение в жилых зонах" } },
    { id: "day5-topic7", lessonId: "day5-topic7", testSlug: "day5-topic7", testNo: 34, questionCount: 28, title: { uz: "Mexanik transport vositalarini shatakka olish", cyrl: "Механик транспорт воситаларини шатакка олиш", ru: "Буксировка механических транспортных средств" } },
    { id: "day5-topic8", lessonId: "day5-topic8", testSlug: "day5-topic8", testNo: 36, questionCount: 20, title: { uz: "Odam tashish", cyrl: "Одам ташиш", ru: "Перевозка людей" } },
  ]},
  { day: 6, topics: [
    { id: "day6-topic1", lessonId: "day6-topic1", testSlug: "day6-topic1", testNo: 2, questionCount: 13, title: { uz: "Haydovchining umumiy vazifalari", cyrl: "Ҳайдовчининг умумий вазифалари", ru: "Общие обязанности водителей" } },
    { id: "day6-topic2", lessonId: "day6-topic2", testSlug: "day6-topic2", testNo: 3, questionCount: 19, title: { uz: "Piyodalarning umumiy vazifalari", cyrl: "Пиёдаларнинг умумий вазифалари", ru: "Обязанности пешеходов" } },
    { id: "day6-topic3", lessonId: "day6-topic3", testSlug: "day6-topic3", testNo: 4, questionCount: 11, title: { uz: "Maxsus transport vositalarining imtiyozlari", cyrl: "Махсус транспорт воситаларининг имтиёзлари", ru: "Приоритет специальных транспортных средств" } },
    { id: "day6-topic4", lessonId: "day6-topic4", testSlug: "day6-topic4", testNo: 16, questionCount: 25, title: { uz: "Ogohlantiruvchi va avariya ishoralari", cyrl: "Огоҳлантирувчи ва авария ишоралари", ru: "Предупредительные и аварийные сигналы" } },
    { id: "day6-topic5", lessonId: "day6-topic5", testSlug: "day6-topic5", testNo: 27, questionCount: 14, title: { uz: "Piyodalar o'tish joylari va yo'nalishli transport vositalarining bekatlari", cyrl: "Пиёдалар ўтиш жойлари ва йўналишли транспорт воситаларининг бекатлари", ru: "Пешеходные переходы и остановки маршрутных транспортных средств" } },
    { id: "day6-topic6", lessonId: "day6-topic6", testSlug: "day6-topic6", testNo: 32, questionCount: 22, title: { uz: "Yo'nalishli transport vositalarining imtiyozlari", cyrl: "Йўналишли транспорт воситаларининг имтиёзлари", ru: "Приоритет маршрутных транспортных средств" } },
    { id: "day6-topic7", lessonId: "day6-topic7", testSlug: "day6-topic7", testNo: 33, questionCount: 21, title: { uz: "Tashqi yoritish asboblaridan foydalanish", cyrl: "Ташқи ёритиш асбобларидан фойдаланиш", ru: "Пользование внешними световыми приборами" } },
  ]},
  { day: 7, isFinalExam: true, topics: [
    { testNo: null, questionCount: 1253, title: { uz: "Yakuniy test", cyrl: "Якуний тест", ru: "Итоговый тест" } },
  ]},
];

export function topicIdFor(testNo: number): string {
  return `topic-${testNo}`;
}

/**
 * Mavzu havolasi: video darsi bo'lsa — mavzu sahifasi (avval video, keyin
 * test); faqat test banki bo'lsa — test sahifasi; aks holda mavzu sahifasi.
 */
export function topicHref(topic: Topic): string {
  return topic.testSlug && !topic.lessonId ? testHref(topic.testSlug) : topicPageHref(topic);
}

export function topicPageHref(topic: Topic): string {
  return `/kabinet/mavzu/${topic.id}`;
}

export function testHref(testSlug: string): string {
  return `/test/${testSlug}`;
}

/** Mavzuning "Kalit so'zlar" bo'limi (test banki bo'lsa). */
export function keywordsHref(topic: Topic): string {
  return `${topicPageHref(topic)}/kalit-sozlar`;
}

function dayIdFor(day: number): string {
  return `day-${day}`;
}

/** Mavzu qaysi kunda (1–6). */
export function topicDayNumber(topic: Pick<Topic, "dayId">): number {
  return Number(topic.dayId.replace("day-", ""));
}

/** Kurs kunlari (`Day`) — yakuniy imtihon kuni mavzusiz, `isFinalExam` bilan. */
export const COURSE_DAYS: Day[] = CURRICULUM.map((d) => ({
  id: dayIdFor(d.day),
  number: d.day,
  isFinalExam: d.isFinalExam ?? false,
  topicIds: d.isFinalExam
    ? []
    : d.topics.map((t) => t.id ?? topicIdFor(t.testNo as number)),
}));

/** 1–6-kunlardagi barcha mavzular, kun ichidagi tartibda. */
export const COURSE_TOPICS: Topic[] = CURRICULUM.filter((d) => !d.isFinalExam).flatMap((d) =>
  d.topics.map((t, index) => ({
    id: t.id ?? topicIdFor(t.testNo as number),
    number: t.testNo as number,
    order: index + 1,
    title: t.title,
    testSlug: t.testSlug,
    lessonId: t.lessonId,
    dayId: dayIdFor(d.day),
    questionCount: t.questionCount,
  })),
);

/**
 * Kurs tartibidagi keyingi mavzu (kun ichida, kun tugasa — keyingi kunning
 * 1-mavzusi); video yoki testi yo'q ("Tez orada") mavzular o'tkazib yuboriladi.
 */
export function nextCourseTopic(topic: Pick<Topic, "id">): Topic | undefined {
  const ids = COURSE_DAYS.filter((d) => !d.isFinalExam)
    .sort((a, b) => a.number - b.number)
    .flatMap((d) => d.topicIds);
  const index = ids.indexOf(topic.id);
  if (index < 0) return undefined;
  for (const id of ids.slice(index + 1)) {
    const next = COURSE_TOPICS.find((t) => t.id === id);
    if (next && (next.testSlug || next.lessonId)) return next;
  }
  return undefined;
}
