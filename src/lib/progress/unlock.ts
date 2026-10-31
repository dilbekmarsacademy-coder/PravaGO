// Qulflash mantiqi — sof funksiyalar (React'ga bog'liq emas, komponentlarda
// takrorlanmaydi). Barcha kirish/ochish qarorlari FAQAT shu fayl orqali
// qabul qilinadi.

import { PASS_PERCENT } from "@/config/rules";
import type { Day, ExamProgress, Topic, TopicProgress } from "@/lib/course-types";

export type TopicStage = "video" | "pdf" | "test";

export type ProgressByTopicId = Record<string, TopicProgress | undefined>;
export type TopicsByDayId = Record<string, Topic[]>;

/**
 * Mavzuda hali video ham, test ham yo'q — "Tez orada". Bunday mavzu ochiq
 * ko'rinadi, lekin tugatib bo'lmaydi, shuning uchun keyingi mavzu/kunlarni
 * qulflamaydi va "davom ettirish" nishoni bo'lmaydi.
 */
export function isTopicComingSoon(topic: Pick<Topic, "testSlug" | "lessonId">): boolean {
  return !topic.testSlug && !topic.lessonId;
}

/**
 * Mavzu tugaganmi: test banki bo'lsa — test o'tilgan; faqat video bo'lsa —
 * video serverda "ko'rildi" deb belgilangan.
 */
export function isTopicDone(topic: Topic, progress: TopicProgress | undefined): boolean {
  if (topic.testSlug) return isTopicCompleted(progress);
  return Boolean(topic.lessonId && progress?.videoWatched);
}

/**
 * Keyingi mavzuni ochish uchun bu mavzu to'siq emas: tugagan yoki hali testi
 * yo'q (video/"Tez orada" mavzular ketma-ketlikni qulflamaydi — test darvozasi
 * esa mavzu ichida, video oxirigacha ko'rilguncha yopiq).
 */
function isTopicPassable(topic: Topic, progressByTopicId: ProgressByTopicId): boolean {
  return !topic.testSlug || isTopicDone(topic, progressByTopicId[topic.id]);
}

/** "Davom ettirish" uchun yaroqli: testi bor yoki videosi serverda mavjud. */
function isTopicStudyable(topic: Topic, progress: TopicProgress | undefined): boolean {
  return Boolean(topic.testSlug) || (Boolean(topic.lessonId) && progress?.videoPercent !== undefined);
}

/** Mavzu "tugagan" — oxirgi urinishlardan biri PASS_PERCENT dan katta yoki teng bo'lsa. */
export function isTopicCompleted(progress: TopicProgress | undefined): boolean {
  if (!progress || progress.attempts.length === 0) return false;
  return progress.attempts.some((attempt) => attempt.percent >= PASS_PERCENT);
}

/** Mavzu bo'yicha eng yaxshi (eng yuqori) urinish foizi, urinish bo'lmasa — null. */
export function getTopicBestPercent(progress: TopicProgress | undefined): number | null {
  if (!progress || progress.attempts.length === 0) return null;
  return Math.max(...progress.attempts.map((attempt) => attempt.percent));
}

/** Oxirgi urinish foizi (mavjud bo'lsa), aks holda null. */
export function getTopicLastPercent(progress: TopicProgress | undefined): number | null {
  if (!progress || progress.attempts.length === 0) return null;
  return progress.attempts[progress.attempts.length - 1].percent;
}

/** Mavzu ichidagi joriy bosqich: video → pdf → test. */
export function getTopicStage(progress: TopicProgress | undefined): TopicStage {
  if (!progress?.videoWatched) return "video";
  if (!progress?.pdfOpened) return "pdf";
  return "test";
}

/** Har bir kunning 1-mavzusi oldingi kun/mavzu shartisiz ochiq (oy o'rtasidan qo'shilganlar istalgan kundan boshlay oladi). */
export function isDayEntryTopic(topic: Topic, dayTopics: Topic[]): boolean {
  return dayTopics.findIndex((t) => t.id === topic.id) <= 0;
}

/**
 * Mavzu ochiqmi: kunning 1-mavzusi — har doim; qolganlari — shu kun ichidagi
 * oldingi barcha mavzular tugagan (test bo'lsa — biror urinishda PASS_PERCENT
 * dan yuqori) yoki "Tez orada" bo'lsa. Oldingi KUNLAR tugaganmi — ahamiyatsiz:
 * istalgan kundan boshlagan o'quvchi shu kunni oxirigacha ketma-ket o'ta oladi.
 * `dayTopics` — shu kunning mavzulari, kun ichidagi tartibda (`day.topicIds` bo'yicha).
 * `_dayUnlocked` — eski chaqiruvlar bilan moslik uchun (qaror qabul qilishda ishlatilmaydi).
 */
export function isTopicUnlocked(
  topic: Topic,
  dayTopics: Topic[],
  progressByTopicId: ProgressByTopicId,
  _dayUnlocked?: boolean,
): boolean {
  void _dayUnlocked;
  if (isDayEntryTopic(topic, dayTopics)) return true;
  const index = dayTopics.findIndex((t) => t.id === topic.id);
  return dayTopics.slice(0, index).every((t) => isTopicPassable(t, progressByTopicId));
}

/**
 * Kun "joriy"mi (kabinetdagi belgi uchun): 1-kun YOKI oldingi kunning barcha
 * mavzulari tugagan (yoki "Tez orada") bo'lsa. Mavzularni qulflamaydi — qarang: isTopicUnlocked.
 * `days` kamida shu kun va undan oldingi kunlarni o'z ichiga olishi kerak.
 */
export function isDayUnlocked(
  day: Day,
  days: Day[],
  topicsByDayId: TopicsByDayId,
  progressByTopicId: ProgressByTopicId,
): boolean {
  const sortedDays = [...days].sort((a, b) => a.number - b.number);
  const index = sortedDays.findIndex((d) => d.id === day.id);
  if (index <= 0) return true;

  const previousDay = sortedDays[index - 1];
  const previousTopics = topicsByDayId[previousDay.id] ?? [];
  if (previousTopics.length === 0) return true;

  return previousTopics.every((topic) => isTopicPassable(topic, progressByTopicId));
}

/** Yakuniy imtihon (7-kun) ochiqmi: 1-6-kunlarning barcha mavzulari tugagan bo'lsa. */
export function isFinalExamUnlocked(
  days: Day[],
  topicsByDayId: TopicsByDayId,
  progressByTopicId: ProgressByTopicId,
): boolean {
  const regularDays = days.filter((day) => !day.isFinalExam);
  if (regularDays.length === 0) return false;

  return regularDays.every((day) => {
    const dayTopics = topicsByDayId[day.id] ?? [];
    // 1-6-kunlar har doim mavzuga ega bo'lishi kerak — mavzu ro'yxati
    // noma'lum/bo'sh bo'lsa, bu kun "tugagan" deb hisoblanmaydi.
    if (dayTopics.length === 0) return false;
    return dayTopics.every((topic) => isTopicDone(topic, progressByTopicId[topic.id]));
  });
}

export interface TopicViewState {
  topic: Topic;
  progress: TopicProgress | undefined;
  completed: boolean;
  unlocked: boolean;
  bestPercent: number | null;
  lastPercent: number | null;
  stage: TopicStage;
}

export interface DayViewState {
  day: Day;
  topics: TopicViewState[];
  unlocked: boolean;
  completed: boolean;
}

export interface ContinueTarget {
  dayNumber: number;
  topic: TopicViewState;
}

export interface CourseState {
  days: DayViewState[];
  finalExamUnlocked: boolean;
  allRegularDaysCompleted: boolean;
  continueTarget: ContinueTarget | null;
}

/**
 * Kurs, mavzular va progressdan foydalanuvchiga ko'rsatiladigan to'liq holatni
 * quradi: har bir kun/mavzu uchun qulf holati, "davom ettirish" nishoni va
 * yakuniy imtihon ochiqligi. Komponentlar faqat shu natijani iste'mol qiladi.
 */
export function buildCourseState(
  days: Day[],
  topics: Topic[],
  topicProgress: TopicProgress[],
  _examProgress: ExamProgress,
): CourseState {
  void _examProgress;

  const progressByTopicId: ProgressByTopicId = Object.fromEntries(
    topicProgress.map((progress) => [progress.topicId, progress]),
  );

  const topicsByDayId: TopicsByDayId = {};
  for (const topic of topics) {
    const list = topicsByDayId[topic.dayId] ?? (topicsByDayId[topic.dayId] = []);
    list.push(topic);
  }
  // Har bir kun ichida mavzular `day.topicIds` tartibida bo'lishi kerak
  // (kun ichidagi ketma-ketlik shu ro'yxat orqali belgilanadi).
  for (const day of days) {
    const ordered = day.topicIds
      .map((id) => topicsByDayId[day.id]?.find((t) => t.id === id))
      .filter((t): t is Topic => Boolean(t));
    if (ordered.length > 0) topicsByDayId[day.id] = ordered;
  }

  const sortedDays = [...days].sort((a, b) => a.number - b.number);

  let continueTarget: ContinueTarget | null = null;
  const dayStates: DayViewState[] = sortedDays.map((day) => {
    const dayTopics = topicsByDayId[day.id] ?? [];
    const unlocked = isDayUnlocked(day, sortedDays, topicsByDayId, progressByTopicId);

    const topicStates: TopicViewState[] = dayTopics.map((topic) => {
      const progress = progressByTopicId[topic.id];
      const completed = isTopicDone(topic, progress);
      const topicUnlocked = isTopicUnlocked(topic, dayTopics, progressByTopicId, unlocked);

      const state: TopicViewState = {
        topic,
        progress,
        completed,
        unlocked: topicUnlocked,
        bestPercent: getTopicBestPercent(progress),
        lastPercent: getTopicLastPercent(progress),
        stage: getTopicStage(progress),
      };

      if (!continueTarget && topicUnlocked && !completed && isTopicStudyable(topic, progress)) {
        continueTarget = { dayNumber: day.number, topic: state };
      }

      return state;
    });

    return {
      day,
      topics: topicStates,
      unlocked,
      completed: topicStates.length > 0 && topicStates.every((t) => t.completed),
    };
  });

  const finalExamUnlocked = isFinalExamUnlocked(sortedDays, topicsByDayId, progressByTopicId);
  const allRegularDaysCompleted = dayStates
    .filter((d) => !d.day.isFinalExam)
    .every((d) => d.completed);

  return { days: dayStates, finalExamUnlocked, allRegularDaysCompleted, continueTarget };
}
