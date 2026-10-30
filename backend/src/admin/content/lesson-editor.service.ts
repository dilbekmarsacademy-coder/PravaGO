import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { LessonCatalogService } from "../../lessons/lesson-catalog.service";
import { findLesson, findLessonIdForTopic } from "../../lessons/lessons.config";
import type { AdminUser } from "../admin-request";
import { AuditService } from "../audit.service";
import { QuestionEditorService } from "./question-editor.service";

/** Mavzu video darsi — admin panel uchun (video ID faqat admin API'da). */
export interface AdminLessonDto {
  lessonId: string;
  videoId: string;
  durationSec: number;
  /** Kod (LESSONS) dagi asl qiymat — "Asl holatga qaytarish" uchun. */
  defaultVideoId: string;
  defaultDurationSec: number;
  overridden: boolean;
  updatedAt: string | null;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** YouTube havolasi yoki ID'si → 11 belgili ID (noto'g'ri bo'lsa null). */
export function parseYoutubeId(input: string): string | null {
  const value = input.trim();
  if (YOUTUBE_ID.test(value)) return value;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null | undefined;
  if (host === "youtu.be") id = url.pathname.split("/")[1];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1];
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

@Injectable()
export class LessonEditorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: LessonCatalogService,
    private readonly editor: QuestionEditorService,
    private readonly audit: AuditService,
  ) {}

  private async resolve(slug: string): Promise<string | null> {
    const topic = await this.prisma.topic.findUnique({ where: { slug }, select: { slug: true, kind: true } });
    if (!topic) throw new NotFoundException("Mavzu topilmadi");
    this.editor.assertEditable(topic);
    return findLessonIdForTopic(slug) ?? (findLesson(slug) ? slug : null);
  }

  private async toDto(lessonId: string): Promise<AdminLessonDto> {
    const base = findLesson(lessonId)!;
    const [current, row] = await Promise.all([
      this.catalog.get(lessonId),
      this.prisma.lessonVideo.findUnique({ where: { lessonId }, select: { updatedAt: true } }),
    ]);
    return {
      lessonId,
      videoId: current!.videoId,
      durationSec: current!.durationSec,
      defaultVideoId: base.videoId,
      defaultDurationSec: base.durationSec,
      overridden: row !== null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }

  /** Mavzuning video darsi; darsi yo'q mavzu uchun null. */
  async get(slug: string): Promise<AdminLessonDto | null> {
    const lessonId = await this.resolve(slug);
    return lessonId ? this.toDto(lessonId) : null;
  }

  private async lessonOrThrow(slug: string): Promise<string> {
    const lessonId = await this.resolve(slug);
    if (!lessonId) throw new NotFoundException({ statusCode: 404, code: "LESSON_NOT_FOUND", message: "Bu mavzuda video dars yo'q" });
    return lessonId;
  }

  async update(admin: AdminUser, ip: string, slug: string, input: { video: string; durationSec: number }): Promise<AdminLessonDto> {
    const lessonId = await this.lessonOrThrow(slug);
    const videoId = parseYoutubeId(input.video);
    if (!videoId) throw new BadRequestException({ statusCode: 400, code: "INVALID_VIDEO", message: "YouTube havolasi yoki video ID'si noto'g'ri" });
    const before = await this.toDto(lessonId);
    await this.prisma.lessonVideo.upsert({
      where: { lessonId },
      create: { lessonId, videoId, durationSec: input.durationSec, updatedById: admin.id },
      update: { videoId, durationSec: input.durationSec, updatedById: admin.id },
    });
    this.catalog.invalidate();
    const after = await this.toDto(lessonId);
    await this.audit.log(admin, ip, { action: "lesson.video.updated", entityType: "lesson", entityId: lessonId, before, after });
    return after;
  }

  /** Kod (LESSONS) dagi asl videoga qaytarish. */
  async reset(admin: AdminUser, ip: string, slug: string): Promise<AdminLessonDto> {
    const lessonId = await this.lessonOrThrow(slug);
    const before = await this.toDto(lessonId);
    await this.prisma.lessonVideo.deleteMany({ where: { lessonId } });
    this.catalog.invalidate();
    const after = await this.toDto(lessonId);
    await this.audit.log(admin, ip, { action: "lesson.video.reset", entityType: "lesson", entityId: lessonId, before, after });
    return after;
  }
}
