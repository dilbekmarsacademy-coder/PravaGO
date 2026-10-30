import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LESSONS, findLesson, type LessonConfig } from "./lessons.config";

/**
 * Amaldagi darslar: LESSONS (kod) + admin panelda almashtirilgan video
 * (LessonVideo jadvali). Almashtirishlar har instansiyada qisqa muddat
 * keshlanadi — progress hisobotlari har so'rovda bazaga murojaat qilmasligi uchun.
 */
const CACHE_TTL_MS = 30_000;

type Override = Pick<LessonConfig, "videoId" | "durationSec">;

@Injectable()
export class LessonCatalogService {
  private cache: { at: number; map: Map<string, Override> } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async overrides(): Promise<Map<string, Override>> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return this.cache.map;
    const rows = await this.prisma.lessonVideo.findMany({ select: { lessonId: true, videoId: true, durationSec: true } });
    const map = new Map(rows.map((r) => [r.lessonId, { videoId: r.videoId, durationSec: r.durationSec }]));
    this.cache = { at: Date.now(), map };
    return map;
  }

  /** Admin o'zgartirgandan keyin — shu instansiyada darhol yangi qiymat. */
  invalidate(): void {
    this.cache = null;
  }

  async get(lessonId: string): Promise<LessonConfig | undefined> {
    const base = findLesson(lessonId);
    if (!base) return undefined;
    const override = (await this.overrides()).get(lessonId);
    return override ? { ...base, ...override } : base;
  }

  async all(): Promise<Record<string, LessonConfig>> {
    const overrides = await this.overrides();
    return Object.fromEntries(Object.keys(LESSONS).map((id) => [id, { ...LESSONS[id], ...overrides.get(id) }]));
  }
}
