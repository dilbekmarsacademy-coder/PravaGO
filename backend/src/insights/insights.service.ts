import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "../ai/ai.service";
import { loadCourseTopics } from "../admin/progress";
import { PASS_PERCENT } from "../common/rules";

export const INSIGHT_LOCALES = ["uz-latn", "uz-cyrl", "ru"] as const;
export type InsightLocale = (typeof INSIGHT_LOCALES)[number];

/** AI xulosasi kuniga ko'pi bilan bir marta (va faqat yangi urinishdan keyin) yangilanadi. */
export const INSIGHT_REFRESH_MS = 24 * 60 * 60 * 1000;

const LANGUAGE: Record<InsightLocale, string> = {
  "uz-latn": "o'zbek tilida, LOTIN yozuvida",
  "uz-cyrl": "o'zbek tilida, KIRILL yozuvida (ўзбек тилида, кирилл ёзувида)",
  ru: "на русском языке",
};

const SYSTEM = `Sen haydovchilik guvohnomasi imtihoniga tayyorlov kursi (PravaTayyor, "6+1 kun") o'quvchisiga shaxsiy murabbiy sifatida qisqa tahlil yozasan.
Senga faqat o'quvchining test natijalari (raqamlar va mavzu nomlari) beriladi — ism, telefon yo'q. Faqat shu raqamlarga tayan, o'ylab topma.
Mavzu testidan o'tish uchun ${PASS_PERCENT}% kerak. Ohang: iliq, rag'batlantiruvchi, aniq. Murojaat "siz".
summary — 2–3 jumla: umumiy holat, kuchli tomon, eng zaif joy. tips — aynan 3 ta qisqa, amalga oshirsa bo'ladigan maslahat (qaysi mavzuni qayta ko'rish, qanday mashq qilish).`;

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    tips: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "tips"],
  additionalProperties: false,
};
const resultSchema = z.object({ summary: z.string().min(1).max(1500), tips: z.array(z.string().min(1).max(400)).min(1).max(5) });

export interface InsightStats {
  attempts: number;
  lastAttemptAt: string | null;
  topics: { total: number; attempted: number; passed: number };
  averagePercent: number;
  recentAveragePercent: number;
  answers: { total: number; correct: number; percent: number };
  weakTopics: { slug: string; day: number; title: string; bestPercent: number; attempts: number }[];
  strongTopics: { slug: string; day: number; title: string; bestPercent: number }[];
  mostWrongTopics: { slug: string; title: string; wrong: number }[];
}

export interface InsightDto {
  stats: InsightStats;
  insight: { summary: string; tips: string[]; locale: string; createdAt: string } | null;
  aiConfigured: boolean;
  canRefresh: boolean;
  nextRefreshAt: string | null;
}

/** "Mening tahlilim": statistika bazadan hisoblanadi; AI faqat qisqa xulosa va 3 maslahat yozadi. */
@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async stats(userId: string, locale: InsightLocale = "uz-latn"): Promise<InsightStats> {
    const topics = await loadCourseTopics(this.prisma);
    const ru = new Map((await this.prisma.topic.findMany({ where: { titleRu: { not: null } }, select: { id: true, titleRu: true } })).map((t) => [t.id, t.titleRu!]));
    const title = (t: { id: string; title: string; titleCyrl: string | null }) =>
      locale === "ru" && ru.get(t.id) ? ru.get(t.id)! : locale === "uz-cyrl" && t.titleCyrl ? t.titleCyrl : t.title;
    const [byTopic, last, recent, answers, wrongByTopic] = await Promise.all([
      this.prisma.topicTestAttempt.groupBy({ by: ["topicId"], where: { userId }, _max: { percent: true }, _count: { _all: true } }),
      this.prisma.topicTestAttempt.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      this.prisma.topicTestAttempt.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10, select: { percent: true } }),
      this.prisma.answerLog.groupBy({ by: ["correct"], where: { userId }, _count: { _all: true } }),
      this.prisma.$queryRaw<{ topicId: string; wrong: bigint }[]>`
        SELECT q."topicId", COUNT(*) AS wrong FROM "AnswerLog" a JOIN "Question" q ON q.id = a."questionId"
        WHERE a."userId" = ${userId} AND NOT a.correct GROUP BY 1 ORDER BY 2 DESC LIMIT 3`,
    ]);
    const course = new Map(topics.map((t) => [t.id, t]));
    const rows = byTopic.flatMap((r) => {
      const t = course.get(r.topicId);
      return t ? [{ slug: t.slug, day: t.day, order: t.order, title: title(t), bestPercent: r._max.percent ?? 0, attempts: r._count._all }] : [];
    });
    const attempts = byTopic.reduce((a, r) => a + r._count._all, 0);
    const correct = answers.find((a) => a.correct)?._count._all ?? 0;
    const totalAnswers = answers.reduce((a, r) => a + r._count._all, 0);
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
    const allTopics = await this.prisma.topic.findMany({ where: { id: { in: wrongByTopic.map((w) => w.topicId) } }, select: { id: true, slug: true, title: true, titleCyrl: true } });
    return {
      attempts,
      lastAttemptAt: last?.createdAt.toISOString() ?? null,
      topics: { total: topics.length, attempted: rows.length, passed: rows.filter((r) => r.bestPercent >= PASS_PERCENT).length },
      averagePercent: avg(rows.map((r) => r.bestPercent)),
      recentAveragePercent: avg(recent.map((r) => r.percent)),
      answers: { total: totalAnswers, correct, percent: totalAnswers ? Math.round((correct / totalAnswers) * 100) : 0 },
      weakTopics: rows
        .filter((r) => r.bestPercent < PASS_PERCENT)
        .sort((a, b) => a.bestPercent - b.bestPercent)
        .slice(0, 3)
        .map(({ slug, day, title: tt, bestPercent, attempts: n }) => ({ slug, day, title: tt, bestPercent, attempts: n })),
      strongTopics: rows
        .filter((r) => r.bestPercent >= PASS_PERCENT)
        .sort((a, b) => b.bestPercent - a.bestPercent || a.day - b.day)
        .slice(0, 3)
        .map(({ slug, day, title: tt, bestPercent }) => ({ slug, day, title: tt, bestPercent })),
      mostWrongTopics: wrongByTopic.flatMap((w) => {
        const t = allTopics.find((x) => x.id === w.topicId);
        return t ? [{ slug: t.slug, title: title(t), wrong: Number(w.wrong) }] : [];
      }),
    };
  }

  private refreshState(row: { updatedAt: Date; basedOnAttemptAt: Date | null; locale: string } | null, stats: InsightStats, locale: InsightLocale, now = Date.now()) {
    if (!stats.attempts) return { canRefresh: false, nextRefreshAt: null };
    if (!row) return { canRefresh: true, nextRefreshAt: null };
    const next = row.updatedAt.getTime() + INSIGHT_REFRESH_MS;
    const hasNewAttempt = !row.basedOnAttemptAt || (stats.lastAttemptAt !== null && new Date(stats.lastAttemptAt) > row.basedOnAttemptAt);
    const changed = hasNewAttempt || row.locale !== locale;
    return { canRefresh: changed && now >= next, nextRefreshAt: changed && now < next ? new Date(next).toISOString() : null };
  }

  async get(userId: string, locale: InsightLocale): Promise<InsightDto> {
    const [stats, row] = await Promise.all([this.stats(userId, locale), this.prisma.aiStudentInsight.findUnique({ where: { userId } })]);
    const content = row?.content as { summary: string; tips: string[] } | undefined;
    return {
      stats,
      insight: row && content ? { ...content, locale: row.locale, createdAt: row.updatedAt.toISOString() } : null,
      aiConfigured: this.ai.configured(),
      ...this.refreshState(row, stats, locale),
    };
  }

  /** Yangi xulosa: faqat yangi urinish bo'lsa (yoki til o'zgarsa) va oxirgisidan 24 soat o'tgan bo'lsa. */
  async refresh(userId: string, locale: InsightLocale): Promise<InsightDto> {
    const current = await this.get(userId, locale);
    if (!current.stats.attempts) throw new BadRequestException({ statusCode: 400, code: "NO_ATTEMPTS", message: "Avval kamida bitta test yeching" });
    if (!current.canRefresh || !this.ai.configured()) return current;
    await this.ai.assertBudget();
    const result = await this.ai.json({
      feature: "student",
      system: SYSTEM,
      content: [{ type: "text", text: `Javob tili: ${LANGUAGE[locale]}.\nO'quvchi natijalari (JSON):\n${JSON.stringify(current.stats)}` }],
      schema: SCHEMA,
      validate: resultSchema,
      maxTokens: 1200,
      meta: { userId },
    });
    const content = { summary: result.summary.trim(), tips: result.tips.slice(0, 3).map((t) => t.trim()) };
    const data = { locale, content: content as unknown as Prisma.InputJsonValue, basedOnAttemptAt: current.stats.lastAttemptAt ? new Date(current.stats.lastAttemptAt) : null };
    await this.prisma.aiStudentInsight.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    return this.get(userId, locale);
  }
}
