import { Injectable, NotFoundException } from "@nestjs/common";
import type { AdminUser } from "../admin-request";
import { AuditService } from "../audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { parseCourseSlug } from "../../common/rules";
import { editableDays } from "./content.config";
import { findLessonIdForTopic } from "../../lessons/lessons.config";
import { QuestionEditorService } from "./question-editor.service";

export type QuestionFilter = "all" | "needsReview" | "noKeywords" | "noCorrect" | "pending";

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly editor: QuestionEditorService,
    private readonly audit: AuditService,
  ) {}

  /**
   * "Javob kutilmoqda" savollar (manbada javobi belgilanmagan) — kun → mavzu
   * bo'yicha: jami va admin javobini belgilagani. Bo'sh bo'lsa — ogohlantirish yo'q.
   */
  async pending() {
    const rows = await this.prisma.question.findMany({
      where: { answerPending: true, deletedAt: null, topic: { kind: "course", deletedAt: null } },
      select: { topic: { select: { slug: true, title: true } }, options: { where: { isCorrect: true }, select: { id: true } } },
    });
    const bySlug = new Map<string, { slug: string; day: number; order: number; title: string; total: number; answered: number }>();
    for (const r of rows) {
      const parsed = parseCourseSlug(r.topic.slug);
      if (!parsed) continue;
      const entry = bySlug.get(r.topic.slug) ?? { slug: r.topic.slug, ...parsed, title: r.topic.title, total: 0, answered: 0 };
      entry.total++;
      if (r.options.length > 0) entry.answered++;
      bySlug.set(r.topic.slug, entry);
    }
    const topics = [...bySlug.values()].sort((a, b) => a.day - b.day || a.order - b.order);
    return {
      total: topics.reduce((n, t) => n + t.total, 0),
      answered: topics.reduce((n, t) => n + t.answered, 0),
      topics,
    };
  }

  /**
   * "Tugatdim": javobi belgilangan kutilayotgan savollar saytga chiqadi
   * (o'quvchi testida paydo bo'ladi). Javobi hali belgilanmaganlari kutishda qoladi.
   */
  async publishPending(admin: AdminUser, ip: string) {
    const ready = await this.prisma.question.findMany({
      where: { answerPending: true, deletedAt: null, options: { some: { isCorrect: true } } },
      select: { id: true, order: true, topic: { select: { slug: true } } },
    });
    if (ready.length) {
      await this.prisma.question.updateMany({ where: { id: { in: ready.map((q) => q.id) } }, data: { answerPending: false } });
      const byTopic: Record<string, number[]> = {};
      for (const q of ready) (byTopic[q.topic.slug] ??= []).push(q.order);
      await this.audit.log(admin, ip, { action: "content.pending_published", entityType: "question", after: { count: ready.length, topics: byTopic } });
    }
    const left = await this.pending();
    return { published: ready.length, remaining: left.total };
  }

  /** Kunlar → mavzular, har mavzu bo'yicha tekshirilmagan / kalit so'zsiz savollar soni. */
  async days() {
    const topics = await this.prisma.topic.findMany({
      where: { kind: "course", deletedAt: null },
      select: {
        slug: true,
        title: true,
        titleCyrl: true,
        questions: {
          where: { deletedAt: null },
          select: {
            ruNeedsReview: true,
            needsReview: true,
            keywords: { select: { needsReview: true, questionText: true, questionTextCyrl: true, answerText: true, answerTextCyrl: true } },
            options: { where: { isCorrect: true }, select: { id: true } },
          },
        },
      },
    });
    const allowed = editableDays();
    const byDay = new Map<number, { day: number; editable: boolean; topics: unknown[] }>();
    const rows = topics
      .flatMap((t) => {
        const parsed = parseCourseSlug(t.slug);
        return parsed ? [{ ...t, ...parsed }] : [];
      })
      .sort((a, b) => a.day - b.day || a.order - b.order);
    for (const t of rows) {
      const entry = byDay.get(t.day) ?? { day: t.day, editable: allowed.includes(t.day), topics: [] };
      entry.topics.push({
        slug: t.slug,
        order: t.order,
        title: t.title,
        titleCyrl: t.titleCyrl,
        questionCount: t.questions.length,
        needsReviewCount: t.questions.filter((q) => q.ruNeedsReview || q.keywords?.needsReview).length,
        noKeywordsCount: t.questions.filter((q) => !hasKeywords(q.keywords)).length,
        noCorrectCount: t.questions.filter((q) => q.options.length === 0).length,
        hasVideo: findLessonIdForTopic(t.slug) !== undefined,
      });
      byDay.set(t.day, entry);
    }
    return [...byDay.values()];
  }

  async topicQuestions(slug: string, filter: QuestionFilter) {
    const topic = await this.prisma.topic.findUnique({ where: { slug }, select: { id: true, slug: true, kind: true, title: true, titleCyrl: true } });
    if (!topic) throw new NotFoundException("Mavzu topilmadi");
    this.editor.assertEditable(topic);
    const questions = await this.prisma.question.findMany({
      where: { topicId: topic.id, deletedAt: null },
      orderBy: { order: "asc" },
      select: {
        id: true,
        order: true,
        text: true,
        textLatn: true,
        imageUrl: true,
        ruNeedsReview: true,
        keywords: { select: { needsReview: true, questionText: true, questionTextCyrl: true, answerText: true, answerTextCyrl: true } },
        options: { where: { isCorrect: true }, select: { id: true } },
        answerPending: true,
        updatedAt: true,
      },
    });
    const items = questions
      .map((q) => ({
        id: q.id,
        order: q.order,
        text: q.textLatn ?? q.text,
        imageUrl: q.imageUrl,
        ruNeedsReview: q.ruNeedsReview,
        keywordNeedsReview: q.keywords?.needsReview ?? false,
        hasKeywords: hasKeywords(q.keywords),
        hasCorrect: q.options.length > 0,
        answerPending: q.answerPending,
        updatedAt: q.updatedAt,
      }))
      .filter((q) =>
        filter === "needsReview"
          ? q.ruNeedsReview || q.keywordNeedsReview
          : filter === "noKeywords"
            ? !q.hasKeywords
            : filter === "noCorrect"
              ? !q.hasCorrect
              : filter === "pending"
                ? q.answerPending
                : true,
      );
    return { topic: { slug: topic.slug, title: topic.title, titleCyrl: topic.titleCyrl, kind: topic.kind }, total: questions.length, items };
  }
}

function hasKeywords(k: { questionText: string | null; questionTextCyrl: string | null; answerText: string | null; answerTextCyrl: string | null } | null): boolean {
  return Boolean(k && (k.questionText || k.questionTextCyrl || k.answerText || k.answerTextCyrl));
}
