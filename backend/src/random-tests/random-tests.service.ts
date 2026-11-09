import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AccessService } from "../access/access.service";
import { toLocalizedText, type LocalizedTextDto } from "../common/localized-text";
import { OPTION_ORDER, STUDENT_QUESTION_WHERE, approvedExplanation, optionText, questionText, toKeywordsDto, type QuestionKeywordsDto } from "../common/question-content";
import { parseCourseSlug } from "../common/rules";
import { userSearch } from "../payments/payments.service";
import { PrismaService } from "../prisma/prisma.service";
import { initialOrder, isOrderLocked } from "../common/option-order";
import { selectQuestions } from "./selection";

// "Random testlar": kunlik mavzu testlari savollaridan tasodifiy test. Vaqt
// faqat serverda hisoblanadi (startedAt, deadlineAt); klient taymerni
// `remainingMs` bo'yicha ko'rsatadi. To'g'ri javob va kalit so'z faqat javob
// berilgandan keyin yoki test tugagach qaytadi.

export const RANDOM_TEST_SIZES = [20, 50, 100, 200] as const;
export const SECONDS_PER_QUESTION = 60;
/** Bitta so'rovda yuklanadigan savollar (200 talik testda ham yengil). */
export const MAX_CHUNK = 25;

export type RandomTestStatus = "in_progress" | "finished" | "expired";

type AttemptRow = Prisma.RandomTestAttemptGetPayload<{ include: { answers: { select: { selectedOptionId: true; correct: true }; orderBy: { position: "asc" } } } }>;

export interface RandomTestSummaryDto {
  id: string;
  size: number;
  total: number;
  status: RandomTestStatus;
  startedAt: Date;
  deadlineAt: Date;
  finishedAt: Date | null;
  answered: number;
  correct: number;
  wrong: number;
  unanswered: number;
  percent: number;
  durationSec: number;
}

export interface RandomTestStateDto extends RandomTestSummaryDto {
  /** Qolgan vaqt (ms) — klient soat farqidan qat'i nazar shu bilan sanaydi. */
  remainingMs: number;
  /** Har savol holati (tartib bo'yicha): javob berilganmi, to'g'rimi. */
  items: { answered: boolean; correct: boolean | null }[];
}

export interface RandomReviewDto {
  selectedOptionId: string | null;
  correct: boolean;
  correctOptionId: string;
  keyword: LocalizedTextDto;
  keywords: QuestionKeywordsDto | null;
  explanation: LocalizedTextDto | null;
}

export interface RandomQuestionDto {
  position: number;
  topicSlug: string;
  question: {
    id: string;
    text: LocalizedTextDto;
    imageUrl: string | null;
    imageSmallUrl?: string;
    imageWidth: number | null;
    imageHeight: number | null;
    options: { id: string; text: LocalizedTextDto }[];
  };
  /** Javob berilgan yoki test tugagan bo'lsa — natija; aks holda `null`. */
  review: RandomReviewDto | null;
}

const questionInclude = {
  options: { orderBy: OPTION_ORDER },
  keywords: true,
  topic: { select: { slug: true } },
} satisfies Prisma.QuestionInclude;
type FullQuestion = Prisma.QuestionGetPayload<{ include: typeof questionInclude }>;

function conflict(code: string, message: string, extra: Record<string, unknown> = {}): ConflictException {
  return new ConflictException({ statusCode: 409, code, message, ...extra });
}

function percentOf(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

export function summary(a: Pick<AttemptRow, "id" | "size" | "total" | "status" | "startedAt" | "deadlineAt" | "finishedAt" | "answered" | "correct" | "percent">, now = new Date()): RandomTestSummaryDto {
  const end = a.finishedAt ?? (now < a.deadlineAt ? now : a.deadlineAt);
  return {
    id: a.id,
    size: a.size,
    total: a.total,
    status: a.status as RandomTestStatus,
    startedAt: a.startedAt,
    deadlineAt: a.deadlineAt,
    finishedAt: a.finishedAt,
    answered: a.answered,
    correct: a.correct,
    wrong: a.answered - a.correct,
    unanswered: a.total - a.answered,
    percent: a.percent,
    durationSec: Math.max(0, Math.min(a.total * SECONDS_PER_QUESTION, Math.round((end.getTime() - a.startedAt.getTime()) / 1000))),
  };
}

function review(q: FullQuestion, selectedOptionId: string | null): RandomReviewDto {
  const correctOption = q.options.find((o) => o.isCorrect);
  return {
    selectedOptionId,
    correct: Boolean(selectedOptionId && correctOption && selectedOptionId === correctOption.id),
    correctOptionId: correctOption?.id ?? "",
    keyword: toLocalizedText(q.keyword, q.keywordRu),
    keywords: toKeywordsDto(q.keywords),
    explanation: approvedExplanation(q),
  };
}

@Injectable()
export class RandomTestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /**
   * Vaqti o'tgan tugallanmagan urinishlar "expired" bo'ladi (javob berilmaganlar
   * xato hisoblanadi — foiz umumiy savollar soniga nisbatan). Faqat o'qishda
   * chaqiriladi — fon vazifasi yo'q.
   */
  async expireOverdue(userId?: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "RandomTestAttempt"
      SET "status" = 'expired', "finishedAt" = "deadlineAt"
      WHERE "status" = 'in_progress' AND "deadlineAt" < now() ${userId ? Prisma.sql`AND "userId" = ${userId}` : Prisma.empty}`;
  }

  /** Testda qatnashadigan savollar: 1–7-kun mavzulari (kurs), o'quvchiga ko'rinadiganlari. */
  private async pool(): Promise<{ id: string; topicId: string }[]> {
    const rows = await this.prisma.question.findMany({
      where: { ...STUDENT_QUESTION_WHERE, topic: { kind: "course", deletedAt: null } },
      select: { id: true, topicId: true, topic: { select: { slug: true } } },
    });
    return rows.filter((q) => {
      const day = parseCourseSlug(q.topic.slug)?.day;
      return day !== undefined && day >= 1 && day <= 7;
    });
  }

  private async load(userId: string, id: string): Promise<AttemptRow> {
    const attempt = await this.prisma.randomTestAttempt.findFirst({
      where: { id, userId },
      include: { answers: { select: { selectedOptionId: true, correct: true }, orderBy: { position: "asc" } } },
    });
    // Boshqa foydalanuvchining urinishi — mavjud emasdek (404).
    if (!attempt) throw new NotFoundException({ statusCode: 404, code: "RANDOM_TEST_NOT_FOUND", message: "Test topilmadi" });
    if (attempt.status === "in_progress" && attempt.deadlineAt.getTime() < Date.now()) {
      await this.expireOverdue(userId);
      return this.load(userId, id);
    }
    return attempt;
  }

  private state(a: AttemptRow): RandomTestStateDto {
    const now = new Date();
    return {
      ...summary(a, now),
      remainingMs: a.status === "in_progress" ? Math.max(0, a.deadlineAt.getTime() - now.getTime()) : 0,
      items: a.answers.map((r) => ({ answered: r.selectedOptionId !== null, correct: r.selectedOptionId !== null ? Boolean(r.correct) : null })),
    };
  }

  /** Kabinet: tugallanmagan test, oldingi natijalar va bazadagi savollar soni. */
  async overview(userId: string) {
    await this.access.assertCourseAccess(userId);
    await this.expireOverdue(userId);
    const [rows, available] = await Promise.all([
      this.prisma.randomTestAttempt.findMany({ where: { userId }, orderBy: { startedAt: "desc" }, take: 50 }),
      this.pool().then((p) => p.length),
    ]);
    const active = rows.find((r) => r.status === "in_progress");
    return {
      sizes: RANDOM_TEST_SIZES,
      secondsPerQuestion: SECONDS_PER_QUESTION,
      available,
      active: active ? { ...summary(active), remainingMs: Math.max(0, active.deadlineAt.getTime() - Date.now()) } : null,
      history: rows.filter((r) => r.status !== "in_progress").map((r) => summary(r)),
    };
  }

  async start(userId: string, size: number, allowFewer: boolean): Promise<RandomTestStateDto> {
    await this.access.assertCourseAccess(userId);
    await this.expireOverdue(userId);
    const active = await this.prisma.randomTestAttempt.findFirst({ where: { userId, status: "in_progress" }, select: { id: true } });
    if (active) throw conflict("RANDOM_TEST_ACTIVE", "Tugallanmagan random test bor — avval uni davom ettiring yoki yakunlang", { attemptId: active.id });

    const pool = await this.pool();
    if (pool.length === 0) throw conflict("RANDOM_TEST_NO_QUESTIONS", "Bazada hali savol yo'q", { available: 0 });
    if (pool.length < size && !allowFewer) {
      throw conflict("RANDOM_TEST_NOT_ENOUGH", `Bazada ${pool.length} ta savol bor`, { available: pool.length });
    }
    const seen = new Set(
      (await this.prisma.randomTestAnswer.findMany({ where: { attempt: { userId } }, select: { questionId: true }, distinct: ["questionId"] })).map((r) => r.questionId),
    );
    const ids = selectQuestions(pool, seen, Math.min(size, pool.length));
    const options = await this.prisma.option.findMany({ where: { questionId: { in: ids } }, orderBy: OPTION_ORDER, select: { id: true, questionId: true, text: true, textLatn: true, textRu: true } });
    const byQuestion = new Map<string, typeof options>();
    for (const o of options) byQuestion.set(o.questionId, [...(byQuestion.get(o.questionId) ?? []), o]);
    // "Hammasi to'g'ri", "1 va 2" kabi variantli savollarda tartib o'zgarmaydi.
    const orderFor = (questionId: string) => {
      const list = byQuestion.get(questionId) ?? [];
      return initialOrder(list.map((o) => o.id), isOrderLocked(list));
    };

    const now = new Date();
    try {
      const attempt = await this.prisma.randomTestAttempt.create({
        data: {
          userId,
          size,
          total: ids.length,
          startedAt: now,
          deadlineAt: new Date(now.getTime() + ids.length * SECONDS_PER_QUESTION * 1000),
          answers: { createMany: { data: ids.map((questionId, position) => ({ questionId, position, optionOrder: orderFor(questionId) })) } },
        },
        include: { answers: { select: { selectedOptionId: true, correct: true }, orderBy: { position: "asc" } } },
      });
      return this.state(attempt);
    } catch (err) {
      // Parallel so'rov: bir foydalanuvchida faqat bitta tugallanmagan test (qisman unique indeks).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const other = await this.prisma.randomTestAttempt.findFirst({ where: { userId, status: "in_progress" }, select: { id: true } });
        throw conflict("RANDOM_TEST_ACTIVE", "Tugallanmagan random test bor", { attemptId: other?.id });
      }
      throw err;
    }
  }

  async get(userId: string, id: string): Promise<RandomTestStateDto> {
    await this.access.assertCourseAccess(userId);
    return this.state(await this.load(userId, id));
  }

  /** Savollar bo'lagi (tartib bo'yicha). Natija faqat javob berilganlarida yoki test tugagach. */
  async questions(userId: string, id: string, from: number, count: number): Promise<RandomQuestionDto[]> {
    await this.access.assertCourseAccess(userId);
    const attempt = await this.load(userId, id);
    const finished = attempt.status !== "in_progress";
    const rows = await this.prisma.randomTestAnswer.findMany({
      where: { attemptId: id, position: { gte: from, lt: from + Math.min(count, MAX_CHUNK) } },
      orderBy: { position: "asc" },
      include: { question: { include: questionInclude } },
    });
    return rows.map((r) => {
      const q = r.question;
      const byId = new Map(q.options.map((o) => [o.id, o]));
      // Saqlangan tartib; keyin qo'shilgan variant bo'lsa — oxirida.
      const ordered = [...r.optionOrder.flatMap((oid) => byId.get(oid) ?? []), ...q.options.filter((o) => !r.optionOrder.includes(o.id))];
      return {
        position: r.position,
        topicSlug: q.topic.slug,
        question: {
          id: q.id,
          text: questionText(q),
          imageUrl: q.imageUrl,
          ...(q.imageSmallUrl ? { imageSmallUrl: q.imageSmallUrl } : {}),
          imageWidth: q.imageWidth,
          imageHeight: q.imageHeight,
          options: ordered.map((o) => ({ id: o.id, text: optionText(o) })),
        },
        review: r.selectedOptionId !== null || finished ? review(q, r.selectedOptionId) : null,
      };
    });
  }

  /** Javob: faqat vaqt ichida, bir marta; o'zgartirib bo'lmaydi. */
  async answer(userId: string, id: string, position: number, optionId: string): Promise<{ review: RandomReviewDto; state: RandomTestStateDto }> {
    await this.access.assertCourseAccess(userId);
    const attempt = await this.load(userId, id);
    if (attempt.status !== "in_progress") {
      throw conflict(attempt.status === "expired" ? "RANDOM_TEST_TIME_UP" : "RANDOM_TEST_FINISHED", attempt.status === "expired" ? "Vaqt tugadi" : "Test yakunlangan");
    }
    const row = await this.prisma.randomTestAnswer.findUnique({
      where: { attemptId_position: { attemptId: id, position } },
      include: { question: { include: questionInclude } },
    });
    if (!row) throw new NotFoundException({ statusCode: 404, code: "RANDOM_TEST_NOT_FOUND", message: "Savol topilmadi" });
    if (row.selectedOptionId !== null) throw conflict("RANDOM_TEST_ALREADY_ANSWERED", "Bu savolga javob berilgan");
    const option = row.question.options.find((o) => o.id === optionId);
    if (!option) throw new BadRequestException("Variant ushbu savolga tegishli emas");

    const answeredAt = new Date();
    const state = await this.prisma.$transaction(async (tx) => {
      // Shart bilan yangilanadi — bir vaqtda ikki so'rov kelsa ham faqat bittasi o'tadi;
      // muddat ham shu yerda (tranzaksiya ichida) tekshiriladi.
      const saved = await tx.randomTestAnswer.updateMany({
        where: { id: row.id, selectedOptionId: null, attempt: { status: "in_progress", deadlineAt: { gte: answeredAt } } },
        data: { selectedOptionId: optionId, correct: option.isCorrect, answeredAt },
      });
      if (saved.count === 0) return null;
      const updated = await tx.randomTestAttempt.update({
        where: { id },
        data: { answered: { increment: 1 }, ...(option.isCorrect ? { correct: { increment: 1 } } : {}) },
      });
      const done = updated.answered >= updated.total;
      return tx.randomTestAttempt.update({
        where: { id },
        data: { percent: percentOf(updated.correct, updated.total), ...(done ? { status: "finished", finishedAt: answeredAt } : {}) },
        include: { answers: { select: { selectedOptionId: true, correct: true }, orderBy: { position: "asc" } } },
      });
    });
    if (!state) {
      const fresh = await this.load(userId, id);
      if (fresh.status === "expired") throw conflict("RANDOM_TEST_TIME_UP", "Vaqt tugadi");
      throw conflict("RANDOM_TEST_ALREADY_ANSWERED", "Bu savolga javob berilgan");
    }
    // Statistika (eng ko'p xato qilinadigan savollar) — javobni sekinlatmaydi.
    this.prisma.answerLog.create({ data: { userId, questionId: row.questionId, correct: option.isCorrect } }).catch(() => undefined);
    return { review: review(row.question, optionId), state: this.state(state) };
  }

  /** "Yakunlash": javob berilmaganlar xato hisoblanadi. Vaqt o'tgan bo'lsa — "expired". */
  async finish(userId: string, id: string): Promise<RandomTestStateDto> {
    await this.access.assertCourseAccess(userId);
    const attempt = await this.load(userId, id);
    if (attempt.status === "in_progress") {
      await this.prisma.randomTestAttempt.updateMany({ where: { id, status: "in_progress" }, data: { status: "finished", finishedAt: new Date() } });
    }
    return this.state(await this.load(userId, id));
  }

  // ── Admin ──

  async adminList(query: { q?: string; userId?: string; status?: RandomTestStatus; page: number; pageSize: number }) {
    await this.expireOverdue();
    const where: Prisma.RandomTestAttemptWhereInput = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q?.trim() ? { user: userSearch(query.q) } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.randomTestAttempt.count({ where }),
      this.prisma.randomTestAttempt.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { user: { select: { id: true, firstName: true, lastName: true, phone: true, login: true, type: true } } },
      }),
    ]);
    return { total, page: query.page, pageSize: query.pageSize, items: rows.map((r) => ({ ...summary(r), user: r.user })) };
  }

  async adminDetail(id: string) {
    await this.expireOverdue();
    const attempt = await this.prisma.randomTestAttempt.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true, login: true, type: true } },
        answers: {
          orderBy: { position: "asc" },
          include: {
            question: {
              select: {
                id: true,
                order: true,
                text: true,
                textLatn: true,
                imageUrl: true,
                topic: { select: { slug: true, title: true } },
                options: { select: { id: true, text: true, textLatn: true, isCorrect: true } },
                keywords: { select: { questionText: true, answerText: true } },
              },
            },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException("Urinish topilmadi");
    const finished = attempt.status !== "in_progress";
    return {
      ...summary(attempt),
      user: attempt.user,
      items: attempt.answers.map((r) => {
        const q = r.question;
        const text = (o: { text: string; textLatn: string | null }) => o.textLatn ?? o.text;
        const correctOption = q.options.find((o) => o.isCorrect);
        const selected = q.options.find((o) => o.id === r.selectedOptionId);
        return {
          position: r.position,
          questionId: q.id,
          topicSlug: q.topic.slug,
          topicTitle: q.topic.title,
          order: q.order,
          text: q.textLatn ?? q.text,
          imageUrl: q.imageUrl,
          selected: selected ? text(selected) : null,
          correctAnswer: correctOption ? text(correctOption) : null,
          // Tugallanmagan testda javob berilmagan savol — hali "xato" emas.
          result: r.selectedOptionId === null ? (finished ? "unanswered" : "pending") : r.correct ? "correct" : "wrong",
          keyword: [q.keywords?.questionText, q.keywords?.answerText].filter(Boolean).join(" → ") || null,
          answeredAt: r.answeredAt,
        };
      }),
    };
  }
}
