// Qulflash mantiqi — sof funksiyalar (React'ga bog'liq emas, komponentlarda
// takrorlanmaydi). Barcha kirish/ochish qarorlari FAQAT shu fayl orqali
// qabul qilinadi.

import { PASS_PERCENT } from "@/config/rules";
import type { Day, ExamProgress, Topic, TopicProgress } from "@/lib/course-types";

export type TopicStage = "video" | "pdf" | "test";

export type ProgressByTopicId = Record<string, TopicProgress | undefined>;
export type TopicsByDayId = Record<string, Topic[]>;

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

/**
 * Mavzu ochiqmi: kunning birinchi mavzusi (kun ochiq bo'lsa) YOKI oldingi
 * mavzu tugagan bo'lsa. `dayTopics` — shu kunning mavzulari, kun ichidagi
 * tartibda (masalan `day.topicIds` bo'yicha) berilishi kerak.
 */
export function isTopicUnlocked(
  topic: Topic,
  dayTopics: Topic[],
  progressByTopicId: ProgressByTopicId,
  dayUnlocked: boolean,
): boolean {
  if (!dayUnlocked) return false;

  const index = dayTopics.findIndex((t) => t.id === topic.id);
  if (index <= 0) return true;

  const previousTopic = dayTopics[index - 1];
  return isTopicCompleted(progressByTopicId[previousTopic.id]);
}

/**
 * Kun ochiqmi: 1-kun YOKI oldingi kunning barcha mavzulari tugagan bo'lsa.
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

  return previousTopics.every((topic) => isTopicCompleted(progressByTopicId[topic.id]));
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
    return dayTopics.every((topic) => isTopicCompleted(progressByTopicId[topic.id]));
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
      const completed = isTopicCompleted(progress);
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

      if (!continueTarget && topicUnlocked && !completed) {
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
