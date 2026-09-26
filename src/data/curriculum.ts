// "6+1 kunlik dastur" — o'quv dasturining asosiy manbai. Kun ichidagi
// mavzular tartibi AYNAN shu ro'yxat bo'yicha (testNo bo'yicha saralanmaydi).
// `testNo` — rasmiy test raqami, test banki shu raqamga bog'lanadi.
//
// `questionCount` hozircha shu yerdan olinadi; savollar banki to'liq import
// qilingach, u DB'dan hisoblanadi va bu raqamlar faqat tekshiruv uchun qoladi.

import type { LocalizedText } from "@/lib/i18n/localized";
import type { Day, Topic } from "@/lib/course-types";

export interface CurriculumTopic {
  testNo: number | null;
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
    { testNo: 14, questionCount: 38, title: { uz: "Svetoforning ishoralari", cyrl: "Светофорнинг ишоралари", ru: "Сигналы светофора" } },
    { testNo: 15, questionCount: 32, title: { uz: "Tartibga soluvchining ishoralari", cyrl: "Тартибга солувчининг ишоралари", ru: "Сигналы регулировщика" } },
    { testNo: 22, questionCount: 14, title: { uz: "Chorrahalarda harakatlanish", cyrl: "Чорраҳаларда ҳаракатланиш", ru: "Проезд перекрёстков" } },
    { testNo: 23, questionCount: 21, title: { uz: "Tartibga solingan chorrahalar", cyrl: "Тартибга солинган чорраҳалар", ru: "Регулируемые перекрёстки" } },
    { testNo: 24, questionCount: 19, title: { uz: "Tartibga solinmagan chorrahalar: asosiy yo'l yo'nalishi to'g'risi", cyrl: "Тартибга солинмаган чорраҳалар: асосий йўл йўналиши тўғриси", ru: "Нерегулируемые перекрёстки: главная дорога прямо" } },
    { testNo: 26, questionCount: 31, title: { uz: "Tartibga solinmagan chorrahalar: asosiy yo'l yo'nalishi o'zgarishi", cyrl: "Тартибга солинмаган чорраҳалар: асосий йўл йўналиши ўзгариши", ru: "Нерегулируемые перекрёстки: главная дорога меняет направление" } },
    { testNo: 25, questionCount: 49, title: { uz: "Tartibga solinmagan chorrahalar: teng ahamiyatli", cyrl: "Тартибга солинмаган чорраҳалар: тенг аҳамиятли", ru: "Нерегулируемые перекрёстки равнозначных дорог" } },
  ]},
  { day: 2, topics: [
    { testNo: 5, questionCount: 37, title: { uz: "Ogohlantiruvchi belgilar", cyrl: "Огоҳлантирувчи белгилар", ru: "Предупреждающие знаки" } },
    { testNo: 6, questionCount: 19, title: { uz: "Imtiyoz belgilari", cyrl: "Имтиёз белгилари", ru: "Знаки приоритета" } },
    { testNo: 7, questionCount: 63, title: { uz: "Taqiqlovchi belgilar", cyrl: "Тақиқловчи белгилар", ru: "Запрещающие знаки" } },
    { testNo: 8, questionCount: 31, title: { uz: "Buyuruvchi belgilar", cyrl: "Буюрувчи белгилар", ru: "Предписывающие знаки" } },
    { testNo: 9, questionCount: 62, title: { uz: "Axborot-ko'rsatkich belgilari", cyrl: "Ахборот-кўрсаткич белгилари", ru: "Информационно-указательные знаки" } },
    { testNo: 10, questionCount: 1, title: { uz: "Servis belgilari", cyrl: "Сервис белгилари", ru: "Знаки сервиса" } },
    { testNo: 11, questionCount: 38, title: { uz: "Qo'shimcha axborot belgilari", cyrl: "Қўшимча ахборот белгилари", ru: "Знаки дополнительной информации (таблички)" } },
  ]},
  { day: 3, topics: [
    { testNo: 17, questionCount: 58, title: { uz: "Harakatlanishni boshlash, manyovr qilish", cyrl: "Ҳаракатланишни бошлаш, манёвр қилиш", ru: "Начало движения, маневрирование" } },
    { testNo: 37, questionCount: 17, title: { uz: "Yuk tashish", cyrl: "Юк ташиш", ru: "Перевозка грузов" } },
    { testNo: 38, questionCount: 13, title: { uz: "Velosiped, moped va aravalar harakatlanishi", cyrl: "Велосипед, мопед ва аравалар ҳаракатланиши", ru: "Движение велосипедов, мопедов и гужевых повозок" } },
    { testNo: 40, questionCount: 46, title: { uz: "Transport vositalaridan foydalanish", cyrl: "Транспорт воситаларидан фойдаланиш", ru: "Эксплуатация транспортных средств" } },
    { testNo: 41, questionCount: 71, title: { uz: "Harakat xavfsizligi asoslari", cyrl: "Ҳаракат хавфсизлиги асослари", ru: "Основы безопасности движения" } },
    { testNo: 42, questionCount: 34, title: { uz: "Birinchi tibbiy yordam", cyrl: "Биринчи тиббий ёрдам", ru: "Первая медицинская помощь" } },
  ]},
  { day: 4, topics: [
    { testNo: 13, questionCount: 5, title: { uz: "Tik chiziqlar", cyrl: "Тик чизиқлар", ru: "Вертикальная разметка" } },
    { testNo: 12, questionCount: 74, title: { uz: "Yotiq chiziqlar", cyrl: "Ётиқ чизиқлар", ru: "Горизонтальная разметка" } },
    { testNo: 19, questionCount: 36, title: { uz: "Harakatlanish tezligi", cyrl: "Ҳаракатланиш тезлиги", ru: "Скорость движения" } },
    { testNo: 21, questionCount: 73, title: { uz: "To'xtash va to'xtab turish", cyrl: "Тўхташ ва тўхтаб туриш", ru: "Остановка и стоянка" } },
    { testNo: 31, questionCount: 3, title: { uz: "Tik balandlik va nishablikda harakatlanish", cyrl: "Тик баландлик ва нишабликда ҳаракатланиш", ru: "Движение на крутых подъёмах и спусках" } },
    { testNo: 35, questionCount: 7, title: { uz: "Transport vositalarini boshqarishni o'rganish", cyrl: "Транспорт воситаларини бошқаришни ўрганиш", ru: "Учебная езда" } },
    { testNo: 39, questionCount: 14, title: { uz: "Mansabdor shaxslar va fuqarolarning yo'l harakati xavfsizligini ta'minlash", cyrl: "Мансабдор шахслар ва фуқароларнинг йўл ҳаракати хавфсизлигини таъминлаш", ru: "Обязанности должностных лиц и граждан по обеспечению безопасности дорожного движения" } },
  ]},
  { day: 5, topics: [
    { testNo: 1, questionCount: 52, title: { uz: "Umumiy qoidalar", cyrl: "Умумий қоидалар", ru: "Общие положения" } },
    { testNo: 18, questionCount: 45, title: { uz: "Yo'lning qatnov qismida transport vositalarining joylashuvi", cyrl: "Йўлнинг қатнов қисмида транспорт воситаларининг жойлашуви", ru: "Расположение транспортных средств на проезжей части" } },
    { testNo: 20, questionCount: 35, title: { uz: "Quvib o'tish", cyrl: "Қувиб ўтиш", ru: "Обгон" } },
    { testNo: 28, questionCount: 18, title: { uz: "Temir yo'l kesishmalari orqali harakatlanish", cyrl: "Темир йўл кесишмалари орқали ҳаракатланиш", ru: "Движение через железнодорожные переезды" } },
    { testNo: 29, questionCount: 15, title: { uz: "Avtomagistrallarda harakatlanish", cyrl: "Автомагистралларда ҳаракатланиш", ru: "Движение по автомагистралям" } },
    { testNo: 30, questionCount: 9, title: { uz: "Turar joy dahalarida harakatlanish", cyrl: "Турар жой даҳаларида ҳаракатланиш", ru: "Движение в жилых зонах" } },
    { testNo: 34, questionCount: 28, title: { uz: "Mexanik transport vositalarini shatakka olish", cyrl: "Механик транспорт воситаларини шатакка олиш", ru: "Буксировка механических транспортных средств" } },
    { testNo: 36, questionCount: 20, title: { uz: "Odam tashish", cyrl: "Одам ташиш", ru: "Перевозка людей" } },
  ]},
  { day: 6, topics: [
    { testNo: 2, questionCount: 13, title: { uz: "Haydovchining umumiy vazifalari", cyrl: "Ҳайдовчининг умумий вазифалари", ru: "Общие обязанности водителей" } },
    { testNo: 3, questionCount: 19, title: { uz: "Piyodalarning umumiy vazifalari", cyrl: "Пиёдаларнинг умумий вазифалари", ru: "Обязанности пешеходов" } },
    { testNo: 4, questionCount: 11, title: { uz: "Maxsus transport vositalarining imtiyozlari", cyrl: "Махсус транспорт воситаларининг имтиёзлари", ru: "Приоритет специальных транспортных средств" } },
    { testNo: 16, questionCount: 25, title: { uz: "Ogohlantiruvchi va avariya ishoralari", cyrl: "Огоҳлантирувчи ва авария ишоралари", ru: "Предупредительные и аварийные сигналы" } },
    { testNo: 27, questionCount: 14, title: { uz: "Piyodalar o'tish joylari va yo'nalishli transport vositalarining bekatlari", cyrl: "Пиёдалар ўтиш жойлари ва йўналишли транспорт воситаларининг бекатлари", ru: "Пешеходные переходы и остановки маршрутных транспортных средств" } },
    { testNo: 32, questionCount: 22, title: { uz: "Yo'nalishli transport vositalarining imtiyozlari", cyrl: "Йўналишли транспорт воситаларининг имтиёзлари", ru: "Приоритет маршрутных транспортных средств" } },
    { testNo: 33, questionCount: 22, title: { uz: "Tashqi yoritish asboblaridan foydalanish", cyrl: "Ташқи ёритиш асбобларидан фойдаланиш", ru: "Пользование внешними световыми приборами" } },
  ]},
  { day: 7, isFinalExam: true, topics: [
    { testNo: null, questionCount: 1254, title: { uz: "Yakuniy test", cyrl: "Якуний тест", ru: "Итоговый тест" } },
  ]},
];

export function topicIdFor(testNo: number): string {
  return `topic-${testNo}`;
}

function dayIdFor(day: number): string {
  return `day-${day}`;
}

/** Kurs kunlari (`Day`) — yakuniy imtihon kuni mavzusiz, `isFinalExam` bilan. */
export const COURSE_DAYS: Day[] = CURRICULUM.map((d) => ({
  id: dayIdFor(d.day),
  number: d.day,
  isFinalExam: d.isFinalExam ?? false,
  topicIds: d.isFinalExam
    ? []
    : d.topics.map((t) => topicIdFor(t.testNo as number)),
}));

/** 1–6-kunlardagi barcha mavzular, kun ichidagi tartibda. */
export const COURSE_TOPICS: Topic[] = CURRICULUM.filter((d) => !d.isFinalExam).flatMap((d) =>
  d.topics.map((t) => ({
    id: topicIdFor(t.testNo as number),
    number: t.testNo as number,
    title: t.title,
    dayId: dayIdFor(d.day),
    questionCount: t.questionCount,
  })),
);
