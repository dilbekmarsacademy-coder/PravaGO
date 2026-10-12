// Video darslar xaritasi — FAQAT serverda. Video manbai (ID) frontend
// kodida hech qachon yozilmaydi: klient uni sessiya bilan
// GET /lessons/:lessonId/video orqali oladi.
//
// Yangi dars qo'shish = shu ro'yxatga bitta qator:
//   - kalit (lessonId) frontend'dagi src/data/curriculum.ts → `lessonId` bilan bir xil;
//   - `durationSec` — videoning to'liq davomiyligi (soniya). "Ko'rildi" holati
//     klient aytgan davomiylikka emas, shu qiymatga qarab hisoblanadi;
//   - `topicSlug` — shu darsdan keyin ochiladigan test (savollar endpointi
//     dars ko'rilmaguncha 403 qaytaradi).

export interface LessonConfig {
  videoId: string;
  durationSec: number;
  topicSlug: string;
}

export const LESSONS: Readonly<Record<string, LessonConfig>> = {
  "day1-topic1": { videoId: "F20q4XLwCa8", durationSec: 1535, topicSlug: "1-kun-2-mavzu-tartibga-soluvchining-ishoralari" },
};

export function findLesson(lessonId: string): LessonConfig | undefined {
  return Object.prototype.hasOwnProperty.call(LESSONS, lessonId) ? LESSONS[lessonId] : undefined;
}

/** Mavzu testini qulflab turgan dars (bo'lmasa — test ochiq). */
export function findLessonIdForTopic(topicSlug: string): string | undefined {
  return Object.keys(LESSONS).find((id) => LESSONS[id].topicSlug === topicSlug);
}
