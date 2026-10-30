// Video darslar xaritasi — FAQAT serverda. Video manbai (ID) frontend
// kodida hech qachon yozilmaydi: klient uni sessiya bilan
// GET /lessons/:lessonId/video orqali oladi.
//
// Yangi dars qo'shish = shu ro'yxatga BITTA qator:
//   "day1-topic1": { videoId: "...", durationSec: 1562 },
//   - kalit (lessonId) — mavzu ID'si, frontend'dagi src/data/curriculum.ts →
//     `lessonId` bilan bir xil (1-kun mavzularida u allaqachon yozilgan);
//   - `durationSec` — videoning to'liq davomiyligi (soniya). "Ko'rildi" holati
//     klient aytgan davomiylikka emas, shu qiymatga qarab hisoblanadi;
//   - `topicSlug` (ixtiyoriy, standart — lessonId) — shu darsdan keyin
//     ochiladigan test banki (savollar endpointi dars ko'rilmaguncha 403).
// Ro'yxatda yo'q dars (masalan day1-topic7) — "video hali olinmagan" holati.
//
// Admin panel (Kontent → mavzu → "Video dars") mavjud darsning videosi va
// davomiyligini almashtira oladi: qiymat LessonVideo jadvaliga yoziladi va shu
// ro'yxatdagidan ustun turadi (LessonCatalogService). Bu yerdagi qiymat —
// "asl video".

export interface LessonConfig {
  videoId: string;
  durationSec: number;
  topicSlug?: string;
}

export const LESSONS: Readonly<Record<string, LessonConfig>> = {
  "day1-topic1": { videoId: "A9F3zO9crj0", durationSec: 1562 },
  "day1-topic2": { videoId: "F20q4XLwCa8", durationSec: 1535 },
  "day1-topic3": { videoId: "pv7W13CHRGk", durationSec: 300 },
  "day1-topic4": { videoId: "5jjEzVv7Pws", durationSec: 942 },
  "day1-topic5": { videoId: "lrpcduEhtLo", durationSec: 1313 },
  "day1-topic6": { videoId: "O1mZdoWf2Bs", durationSec: 1250 },
  "day2-topic1": { videoId: "MnJMdy-EbLc", durationSec: 887 },
  "day2-topic2": { videoId: "ehWyIPbcAOQ", durationSec: 529 },
  "day2-topic3": { videoId: "_eKoTVCDzlQ", durationSec: 1394 },
  "day2-topic4": { videoId: "CtMnfEXCEd4", durationSec: 795 },
  "day2-topic5": { videoId: "3xcj_TYlJbc", durationSec: 1621 },
  "day2-topic6": { videoId: "UINxck9k_Fs", durationSec: 24 },
  "day2-topic7": { videoId: "c6D7TSJxSWc", durationSec: 885 },
  "day3-topic1": { videoId: "knHaqTZNfEw", durationSec: 1634 },
  "day3-topic2": { videoId: "PeP8q0ZK9ks", durationSec: 540 },
  "day3-topic3": { videoId: "B5ktqGG6IHM", durationSec: 276 },
  "day3-topic4": { videoId: "LJ5FSZ_-bao", durationSec: 1222 },
  "day3-topic5": { videoId: "jXXjjkFbMPk", durationSec: 1903 },
  "day3-topic6": { videoId: "ib18XEiInp4", durationSec: 781 },
  "day4-topic1": { videoId: "EEiguIJwKJU", durationSec: 82 },
  "day4-topic2": { videoId: "c4aBQDWRans", durationSec: 1548 },
  "day4-topic3": { videoId: "u7qiKIEVfaM", durationSec: 888 },
  "day4-topic4": { videoId: "ax5g-nHhakU", durationSec: 1500 },
  "day4-topic5": { videoId: "f3Q07R8CHxg", durationSec: 82 },
  "day4-topic6": { videoId: "KEdlkxrYC7A", durationSec: 206 },
  "day4-topic7": { videoId: "YU2Kmbd2Bq4", durationSec: 276 },
  "day5-topic1": { videoId: "srQkhTbh-M8", durationSec: 1323 },
  "day5-topic2": { videoId: "d0MaYGrPXfs", durationSec: 1147 },
  "day5-topic3": { videoId: "QtSXc--eg-I", durationSec: 793 },
  "day5-topic4": { videoId: "jULP4JLMP6w", durationSec: 360 },
  "day5-topic5": { videoId: "Ay5EvqnN-cI", durationSec: 250 },
  "day5-topic6": { videoId: "FmweGPNoZmI", durationSec: 162 },
  "day5-topic7": { videoId: "NNvb6igNLb0", durationSec: 435 },
  "day5-topic8": { videoId: "WWH8wN_wQyA", durationSec: 362 },
  "day6-topic1": { videoId: "kBcw--eJ1AQ", durationSec: 478 },
  "day6-topic2": { videoId: "EZ9-W-BNyJk", durationSec: 430 },
  "day6-topic3": { videoId: "9gl6_XHOirs", durationSec: 390 },
  "day6-topic4": { videoId: "J1rAYfk6_ys", durationSec: 598 },
  "day6-topic5": { videoId: "F_kdHjsBCnU", durationSec: 301 },
  "day6-topic6": { videoId: "VacJgoSsclc", durationSec: 596 },
  "day6-topic7": { videoId: "oCdXh9RbUN0", durationSec: 470 },
};

export function findLesson(lessonId: string): LessonConfig | undefined {
  return Object.prototype.hasOwnProperty.call(LESSONS, lessonId) ? LESSONS[lessonId] : undefined;
}

/** Dars ochadigan test banki slug'i. */
export function lessonTopicSlug(lessonId: string): string {
  return LESSONS[lessonId]?.topicSlug ?? lessonId;
}

/** Mavzu testini qulflab turgan dars (bo'lmasa — test ochiq). */
export function findLessonIdForTopic(topicSlug: string): string | undefined {
  return Object.keys(LESSONS).find((id) => lessonTopicSlug(id) === topicSlug);
}
