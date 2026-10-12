import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { LessonProgress } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { LessonStatusDto, ReportProgressDto } from "./dto/lesson.dto";
import { findLesson, findLessonIdForTopic, type LessonConfig } from "./lessons.config";

/** "Ko'rildi" uchun haqiqatan ko'rilgan qism (davomiylikka nisbatan). */
export const COMPLETION_RATIO = 0.95;
/** Oxirigacha yetib kelindi deb hisoblash chegarasi (soniya). */
const END_TOLERANCE_SEC = 3;
/** Klientdagi eng yuqori tezlik (1.5x) — bir soniya real vaqtda shuncha video soniyasi o'tadi. */
const MAX_PLAYBACK_RATE = 1.5;
/**
 * Bitta hisobotda hisobga olinadigan eng uzoq real vaqt. Klient o'ynayotganda
 * har ~12 s hisobot yuboradi — uzoq tanaffusdan keyin "butun videoni
 * ko'rdim" degan bitta so'rov o'tmasligi uchun.
 */
const MAX_REPORT_GAP_SEC = 60;
/** Tarmoq kechikishi va taymer noaniqliklari uchun zaxira. */
const REPORT_SLACK_SEC = 2;

type ProgressRow = Pick<LessonProgress, "maxPosition" | "watchedSeconds" | "lastPosition" | "completedAt">;

const EMPTY_PROGRESS: ProgressRow = { maxPosition: 0, watchedSeconds: 0, lastPosition: 0, completedAt: null };

function toStatus(lessonId: string, lesson: LessonConfig, row: ProgressRow): LessonStatusDto {
  const completed = row.completedAt !== null;
  return {
    lessonId,
    topicSlug: lesson.topicSlug,
    durationSec: lesson.durationSec,
    position: row.lastPosition,
    maxPosition: row.maxPosition,
    watchedSeconds: row.watchedSeconds,
    watchedPercent: completed ? 100 : Math.min(99, Math.floor((row.watchedSeconds / lesson.durationSec) * 100)),
    completed,
  };
}

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  private getLesson(lessonId: string): LessonConfig {
    const lesson = findLesson(lessonId);
    if (!lesson) throw new NotFoundException("Dars topilmadi");
    return lesson;
  }

  async status(userId: string, lessonId: string): Promise<LessonStatusDto> {
    const lesson = this.getLesson(lessonId);
    const row = await this.prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
    return toStatus(lessonId, lesson, row ?? EMPTY_PROGRESS);
  }

  video(lessonId: string): { videoId: string } {
    return { videoId: this.getLesson(lessonId).videoId };
  }

  /**
   * Klient hisobotini qabul qiladi. Ko'rilgan soniyalar va eng uzoq nuqta
   * oxirgi hisobotdan beri o'tgan real vaqt × 1.5 dan ortiq oshmaydi — shu
   * tufayli soxta so'rovlar bilan ham darsni haqiqiy 1.5x tezlikdagi
   * ko'rishdan tezroq "ko'rildi" qilib bo'lmaydi.
   */
  async reportProgress(userId: string, lessonId: string, report: ReportProgressDto): Promise<LessonStatusDto> {
    const lesson = this.getLesson(lessonId);
    const key = { userId_lessonId: { userId, lessonId } };
    const now = new Date();

    const existing = await this.prisma.lessonProgress.findUnique({ where: key });
    const row = existing ?? EMPTY_PROGRESS;
    if (row.completedAt) {
      // Ko'rilgan dars qayta ko'rilmoqda — faqat davom ettirish nuqtasi yangilanadi.
      const lastPosition = Math.min(report.position, lesson.durationSec);
      const updated = await this.prisma.lessonProgress.update({ where: key, data: { lastPosition, lastReportAt: now } });
      return toStatus(lessonId, lesson, updated);
    }

    const elapsedSec = existing
      ? Math.max(0, (now.getTime() - existing.lastReportAt.getTime()) / 1000)
      : MAX_REPORT_GAP_SEC;
    const budget = Math.min(elapsedSec, MAX_REPORT_GAP_SEC) * MAX_PLAYBACK_RATE + REPORT_SLACK_SEC;

    const watchedSeconds = Math.min(row.watchedSeconds + Math.min(report.watchedDelta, budget), lesson.durationSec);
    const maxPosition = Math.max(
      row.maxPosition,
      Math.min(report.maxPosition, row.maxPosition + budget, lesson.durationSec),
    );
    const lastPosition = Math.min(report.position, maxPosition);
    const reachedEnd = maxPosition >= lesson.durationSec - END_TOLERANCE_SEC;
    const completedAt = reachedEnd && watchedSeconds >= lesson.durationSec * COMPLETION_RATIO ? now : null;

    const data = { maxPosition, watchedSeconds, lastPosition, completedAt, lastReportAt: now };

    if (!existing) {
      const created = await this.prisma.lessonProgress
        .create({ data: { userId, lessonId, ...data } })
        .catch(() => null); // parallel birinchi hisobot (ikki tab) — keyingi hisobot davom ettiradi
      return toStatus(lessonId, lesson, created ?? (await this.prisma.lessonProgress.findUniqueOrThrow({ where: key })));
    }

    // Optimistik qulf: parallel hisobot (masalan, ikki tab) bir xil oraliqni
    // ikki marta hisoblatmasligi uchun — o'zgargan bo'lsa, bu hisobot o'tkaziladi.
    const { count } = await this.prisma.lessonProgress.updateMany({
      where: { userId, lessonId, lastReportAt: existing.lastReportAt },
      data,
    });
    const fresh = count ? { ...existing, ...data } : await this.prisma.lessonProgress.findUniqueOrThrow({ where: key });
    return toStatus(lessonId, lesson, fresh);
  }

  /**
   * Mavzu testi dars ko'rilmaguncha yopiq. Darsi yo'q mavzular uchun hech
   * narsa qilmaydi. Har qanday kelajakdagi dars uchun ham shu ishlaydi.
   */
  async assertTopicUnlocked(topicSlug: string, userId: string | undefined): Promise<void> {
    const lessonId = findLessonIdForTopic(topicSlug);
    if (!lessonId) return;
    const completed =
      userId !== undefined &&
      (await this.prisma.lessonProgress.count({
        where: { userId, lessonId, completedAt: { not: null } },
      })) > 0;
    if (!completed) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "LESSON_NOT_COMPLETED",
        lessonId,
        message: "Testni ochish uchun avval video darsni oxirigacha ko'ring",
      });
    }
  }
}
