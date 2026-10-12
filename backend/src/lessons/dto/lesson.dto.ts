import { IsNumber, Matches, Max, Min } from "class-validator";

const LESSON_ID = /^[a-z0-9-]{1,64}$/;
// Hech bir dars bundan uzun emas — absurd qiymatlarni validatsiyada to'xtatamiz.
const MAX_SECONDS = 6 * 60 * 60;

export class LessonIdParamDto {
  @Matches(LESSON_ID)
  lessonId: string;
}

/**
 * Klientning xom o'lchovlari. Server ularga ishonmaydi: har biri oxirgi
 * hisobotdan beri o'tgan real vaqt bilan cheklanadi.
 */
export class ReportProgressDto {
  /** Joriy pozitsiya (soniya) — davom ettirish uchun. */
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_SECONDS)
  position: number;

  /** Klient ko'rgan eng uzoq nuqta (soniya). */
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_SECONDS)
  maxPosition: number;

  /** Oxirgi tasdiqlangan hisobotdan beri PLAYING holatida ko'rilgan soniyalar. */
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_SECONDS)
  watchedDelta: number;
}

export interface LessonStatusDto {
  lessonId: string;
  topicSlug: string;
  durationSec: number;
  position: number;
  maxPosition: number;
  watchedSeconds: number;
  /** 0–100, butun son. */
  watchedPercent: number;
  completed: boolean;
}
