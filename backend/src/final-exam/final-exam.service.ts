import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type FinalExamAttempt, type FinalExamStatus, type FinalExamType } from "@prisma/client";
import { AccessService } from "../access/access.service";
import type { AdminUser } from "../admin/admin-request";
import { AuditService } from "../admin/audit.service";
import { toLocalizedText } from "../common/localized-text";
import { initialOrder, isOrderLocked, reshuffle } from "../common/option-order";
import { OPTION_ORDER, STUDENT_QUESTION_WHERE, approvedExplanation, optionText, questionText, toKeywordsDto } from "../common/question-content";
import { PASS_PERCENT, parseCourseSlug } from "../common/rules";
import { LESSONS, lessonTopicSlug } from "../lessons/lessons.config";
import { userSearch } from "../payments/payments.service";
import { PrismaService } from "../prisma/prisma.service";
import { buildFailureNote, buildLetter, type WeakTopic } from "./letter";
import { FINAL_EXAM_MAX_ATTEMPTS, FINAL_EXAM_REQUIRES_COURSE, FINAL_EXAM_TYPES, averagePercent, certificateNumber, isPassed, scorePercent } from "./rules";
import { selectExamQuestions, type PoolQuestion } from "./selection";

// Yakuniy ichki imtihon (7-kun). Savollar faqat 1–6-kun mavzu testlaridan.
// Vaqt faqat serverda (startedAt, expiresAt); klient `remainingMs` bo'yicha
// ko'rsatadi. To'g'ri javob imtihon tugaguncha chiqmaydi, javob variant ID
// bo'yicha serverda tekshiriladi. Har turga 10 ta urinish; 10 tasi tugagach
// o'rtacha >= 98% bo'lsa — sertifikat (faqat server qaroriga ko'ra).

/** Urinishdagi bitta savol (FinalExamAttempt.questions elementi). */
export interface AttemptQuestion {
  questionId: string;
  topicId: string;
  topicSlug: string;
  day: number;
  /** Ko'rsatiladigan variantlar tartibi (ID'lar). */
  optionOrder: string[];
  /** "Hammasi to'g'ri" kabi variantli savol — tartib o'zgarmaydi. */
  locked: boolean;
  /** Imtihon tugagach yoziladi. */
  correct?: boolean;
}

export type AttemptAnswers = Record<string, { optionId: string; answeredAt: string }>;

export type ExamOutcome = "in_progress" | "passed" | "failed";

const COUNTED = { archivedAt: null } satisfies Prisma.FinalExamAttemptWhereInput;

function conflict(code: string, message: string, extra: Record<string, unknown> = {}): ConflictException {
  return new ConflictException({ statusCode: 409, code, message, ...extra });
}

function questionsOf(a: Pick<FinalExamAttempt, "questions">): AttemptQuestion[] {
  return a.questions as unknown as AttemptQuestion[];
}

function answersOf(a: Pick<FinalExamAttempt, "answers">): AttemptAnswers {
  return (a.answers ?? {}) as unknown as AttemptAnswers;
}

function remainingMs(a: Pick<FinalExamAttempt, "status" | "expiresAt">, now = Date.now()): number {
  return a.status === "IN_PROGRESS" ? Math.max(0, a.expiresAt.getTime() - now) : 0;
}

/** Urinish qisqa ko'rinishi (ro'yxatlar uchun) — to'g'ri javobsiz. */
function attemptSummary(a: FinalExamAttempt) {
  const answered = Object.keys(answersOf(a)).length;
  const done = a.status !== "IN_PROGRESS";
  return {
    id: a.id,
    type: a.type,
    status: a.status,
    startedAt: a.startedAt,
    expiresAt: a.expiresAt,
    finishedAt: a.finishedAt,
    total: a.totalQuestions,
    answered,
    correct: done ? a.correctCount : null,
    percent: done ? a.scorePercent : null,
    /** Sarflangan vaqt (soniya): yakunlangan urinishda boshlanishdan tugashgacha. */
    durationSec: done && a.finishedAt ? durationSec(a.startedAt, a.finishedAt) : null,
  };
}

function durationSec(startedAt: Date, finishedAt: Date): number {
  return Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000));
}

const userBrief = { id: true, firstName: true, lastName: true, phone: true, login: true, type: true } satisfies Prisma.UserSelect;

@Injectable()
export class FinalExamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  // ── Qulf va savollar bazasi ──

  /** Savollar bazasi: 1–6-kun kurs mavzulari, o'quvchiga ko'rinadigan savollar. */
  async pool(): Promise<(PoolQuestion & { topicSlug: string })[]> {
    const rows = await this.prisma.question.findMany({
      where: { ...STUDENT_QUESTION_WHERE, topic: { kind: "course", deletedAt: null } },
      select: { id: true, topicId: true, topic: { select: { slug: true } } },
    });
    return rows.flatMap((q) => {
      const day = parseCourseSlug(q.topic.slug)?.day;
      return day !== undefined && day >= 1 && day <= 6 ? [{ id: q.id, topicId: q.topicId, topicSlug: q.topic.slug, day }] : [];
    });
  }

  /**
   * 1–6-kun mavzulari tugaganmi (kabinetdagi isFinalExamUnlocked bilan bir xil):
   * testi bor mavzu — biror urinishda >= 98%; testsiz (faqat video) mavzu — video ko'rilgan.
   * Admin "hammasini ochgan" o'quvchiga — ochiq.
   */
  async unlockState(userId: string): Promise<{ unlocked: boolean; remainingTopics: number }> {
    if (await this.access.hasUnlockAll(userId)) return { unlocked: true, remainingTopics: 0 };
    const topics = await this.prisma.topic.findMany({
      where: { kind: "course", deletedAt: null },
      select: { id: true, slug: true, _count: { select: { questions: { where: STUDENT_QUESTION_WHERE } } } },
    });
    const regular = topics.filter((t) => {
      const day = parseCourseSlug(t.slug)?.day;
      return day !== undefined && day >= 1 && day <= 6;
    });
    const testTopics = regular.filter((t) => t._count.questions > 0);
    const testSlugs = new Set(testTopics.map((t) => t.slug));
    const lessonOnly = Object.keys(LESSONS).filter((id) => {
      const slug = lessonTopicSlug(id);
      const day = parseCourseSlug(slug)?.day;
      return day !== undefined && day >= 1 && day <= 6 && !testSlugs.has(slug);
    });
    if (testTopics.length === 0) return { unlocked: false, remainingTopics: 0 };
    const [passed, watched] = await Promise.all([
      this.prisma.topicTestAttempt.findMany({
        where: { userId, topicId: { in: testTopics.map((t) => t.id) }, percent: { gte: PASS_PERCENT } },
        select: { topicId: true },
        distinct: ["topicId"],
      }),
      lessonOnly.length
        ? this.prisma.lessonProgress.findMany({ where: { userId, lessonId: { in: lessonOnly }, completedAt: { not: null } }, select: { lessonId: true } })
        : Promise.resolve([]),
    ]);
    const remaining = testTopics.length - passed.length + (lessonOnly.length - new Set(watched.map((w) => w.lessonId)).size);
    return { unlocked: remaining === 0, remainingTopics: remaining };
  }

  /** Imtihon ochiqmi: kurs sharti o'chirilgan bo'lsa — hammaga (kursga kirish huquqi bilan). */
  async examLock(userId: string): Promise<{ unlocked: boolean; remainingTopics: number }> {
    const course = await this.unlockState(userId);
    return { unlocked: !FINAL_EXAM_REQUIRES_COURSE || course.unlocked, remainingTopics: course.remainingTopics };
  }

  private async assertUnlocked(userId: string): Promise<void> {
    const { unlocked, remainingTopics } = await this.examLock(userId);
    if (!unlocked) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "FINAL_EXAM_LOCKED",
        remainingTopics,
        message: "Yakuniy imtihon uchun avval 1–6-kunlarning barcha mavzularini tugating",
      });
    }
  }

  // ── Urinishni yakunlash va sertifikat ──

  /**
   * Urinishni yakunlaydi: javoblar bazadagi to'g'ri variant ID'lari bilan
   * solishtiriladi (javobsiz — xato). Faqat IN_PROGRESS bo'lsa (parallel so'rovda
   * bittasi o'tadi). Keyin 10 ta urinish to'lgan bo'lsa — sertifikat.
   */
  private async finalize(attempt: FinalExamAttempt, status: Exclude<FinalExamStatus, "IN_PROGRESS">, finishedAt: Date): Promise<void> {
    const items = questionsOf(attempt);
    const answers = answersOf(attempt);
    const correctOptions = await this.prisma.option.findMany({
      where: { questionId: { in: items.map((q) => q.questionId) }, isCorrect: true },
      select: { id: true, questionId: true },
    });
    const correctIds = new Set(correctOptions.map((o) => o.id));
    const graded = items.map((q, i) => ({ ...q, correct: Boolean(answers[i] && correctIds.has(answers[i].optionId)) }));
    const correctCount = graded.filter((q) => q.correct).length;
    const updated = await this.prisma.finalExamAttempt.updateMany({
      where: { id: attempt.id, status: "IN_PROGRESS" },
      data: {
        status,
        finishedAt,
        correctCount,
        scorePercent: scorePercent(correctCount, attempt.totalQuestions),
        questions: graded as unknown as Prisma.InputJsonValue,
      },
    });
    if (updated.count > 0) await this.issueCertificateIfPassed(attempt.userId, attempt.type);
  }

  /** Vaqti o'tgan faol urinishlar — EXPIRED (fon vazifasi yo'q: o'qishda chaqiriladi). */
  async expireOverdue(userId?: string): Promise<void> {
    const overdue = await this.prisma.finalExamAttempt.findMany({
      where: { status: "IN_PROGRESS", expiresAt: { lt: new Date() }, ...(userId ? { userId } : {}) },
    });
    for (const a of overdue) await this.finalize(a, "EXPIRED", a.expiresAt);
  }

  /** Hisobga olinadigan (arxivlanmagan) urinishlar, vaqt bo'yicha. */
  private counted(userId: string, type: FinalExamType) {
    return this.prisma.finalExamAttempt.findMany({ where: { userId, type, ...COUNTED }, orderBy: { startedAt: "asc" } });
  }

  /** 10 ta urinish yakunlangan va o'rtacha >= 98% — sertifikat (bir turga bitta). */
  async issueCertificateIfPassed(userId: string, type: FinalExamType) {
    const existing = await this.prisma.certificate.findUnique({ where: { userId_examType: { userId, examType: type } } });
    if (existing) return existing;
    const attempts = (await this.counted(userId, type)).filter((a) => a.status !== "IN_PROGRESS");
    const percents = attempts.slice(0, FINAL_EXAM_MAX_ATTEMPTS).map((a) => a.scorePercent);
    if (!isPassed(percents)) return null;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
    const fullName = [user?.firstName, user?.lastName].map((s) => s?.trim()).filter(Boolean).join(" ").slice(0, 120);
    const letter = buildLetter({ questions: FINAL_EXAM_TYPES[type].questions, percents });
    const [{ n }] = await this.prisma.$queryRaw<{ n: number }[]>`SELECT nextval(pg_get_serial_sequence('"Certificate"', 'serial'))::int AS n`;
    const issuedAt = new Date();
    try {
      return await this.prisma.certificate.create({
        data: {
          serial: n,
          certificateNumber: certificateNumber(issuedAt.getFullYear(), n),
          userId,
          examType: type,
          averagePercent: averagePercent(percents)!,
          attemptsCount: percents.length,
          fullName,
          letterText: letter.text,
          letterTone: letter.tone,
          issuedAt,
        },
      });
    } catch (err) {
      // Parallel yakunlash — sertifikat allaqachon yaratilgan.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return this.prisma.certificate.findUnique({ where: { userId_examType: { userId, examType: type } } });
      }
      throw err;
    }
  }

  // ── Kabinet ──

  /** Mavzular bo'yicha xato ulushi (yakunlangan urinishlar) — eng ko'p xato qilingan 3 tasi. */
  private async weakTopics(attempts: FinalExamAttempt[]): Promise<WeakTopic[]> {
    const stats = new Map<string, { total: number; wrong: number }>();
    for (const a of attempts) {
      for (const q of questionsOf(a)) {
        const s = stats.get(q.topicId) ?? { total: 0, wrong: 0 };
        s.total += 1;
        if (!q.correct) s.wrong += 1;
        stats.set(q.topicId, s);
      }
    }
    const ranked = [...stats.entries()]
      .filter(([, s]) => s.total >= 2 && s.wrong > 0)
      .map(([topicId, s]) => ({ topicId, errorPercent: Math.round((s.wrong / s.total) * 1000) / 10 }))
      .sort((a, b) => b.errorPercent - a.errorPercent)
      .slice(0, 3);
    const titles = new Map(
      (await this.prisma.topic.findMany({ where: { id: { in: ranked.map((r) => r.topicId) } }, select: { id: true, title: true } })).map((t) => [t.id, t.title]),
    );
    return ranked.map((r) => ({ title: titles.get(r.topicId) ?? "", errorPercent: r.errorPercent })).filter((r) => r.title);
  }

  private async typeOverview(userId: string, type: FinalExamType) {
    const attempts = await this.counted(userId, type);
    const finished = attempts.filter((a) => a.status !== "IN_PROGRESS");
    const percents = finished.map((a) => a.scorePercent);
    const active = attempts.find((a) => a.status === "IN_PROGRESS");
    const certificate = finished.length >= FINAL_EXAM_MAX_ATTEMPTS ? await this.issueCertificateIfPassed(userId, type) : null;
    const outcome: ExamOutcome = finished.length < FINAL_EXAM_MAX_ATTEMPTS ? "in_progress" : certificate ? "passed" : "failed";
    return {
      type,
      ...FINAL_EXAM_TYPES[type],
      maxAttempts: FINAL_EXAM_MAX_ATTEMPTS,
      attemptsUsed: attempts.length,
      attemptsLeft: Math.max(0, FINAL_EXAM_MAX_ATTEMPTS - attempts.length),
      average: averagePercent(percents),
      attempts: attempts.map(attemptSummary),
      active: active ? { id: active.id, remainingMs: remainingMs(active) } : null,
      outcome,
      certificate: certificate ? { certificateNumber: certificate.certificateNumber, averagePercent: certificate.averagePercent, celebrated: certificate.celebratedAt !== null } : null,
      failureNote: outcome === "failed" ? buildFailureNote({ questions: FINAL_EXAM_TYPES[type].questions, percents }, await this.weakTopics(finished)) : null,
    };
  }

  /** Kabinet: qulf holati va har tur bo'yicha urinishlar, o'rtacha, natija. */
  async overview(userId: string) {
    await this.access.assertCourseAccess(userId);
    await this.expireOverdue(userId);
    const [lock, poolSize, q20, q50] = await Promise.all([
      this.examLock(userId),
      this.pool().then((p) => p.length),
      this.typeOverview(userId, "Q20"),
      this.typeOverview(userId, "Q50"),
    ]);
    return { ...lock, poolSize, passAverage: 98, types: [q20, q50] };
  }

  async start(userId: string, type: FinalExamType) {
    await this.access.assertCourseAccess(userId);
    await this.assertUnlocked(userId);
    await this.expireOverdue(userId);
    const attempts = await this.counted(userId, type);
    const active = attempts.find((a) => a.status === "IN_PROGRESS");
    if (active) throw conflict("FINAL_EXAM_ACTIVE", "Tugallanmagan urinish bor — avval uni davom ettiring", { attemptId: active.id });
    if (attempts.length >= FINAL_EXAM_MAX_ATTEMPTS) throw conflict("FINAL_EXAM_NO_ATTEMPTS", "Bu tur uchun 10 ta urinish tugagan");

    const { questions: count, minutes } = FINAL_EXAM_TYPES[type];
    const pool = await this.pool();
    if (pool.length < count) throw conflict("FINAL_EXAM_NOT_ENOUGH", `Bazada ${pool.length} ta savol bor`, { available: pool.length });
    // Oldingi urinishlarda chiqqan savollar ustuvor emas (ikkala tur, arxivlanganlar ham).
    const previous = await this.prisma.finalExamAttempt.findMany({ where: { userId }, select: { questions: true } });
    const seen = new Set(previous.flatMap((a) => questionsOf(a).map((q) => q.questionId)));
    const picked = selectExamQuestions(pool, seen, count);
    const options = await this.prisma.option.findMany({
      where: { questionId: { in: picked.map((q) => q.id) } },
      orderBy: OPTION_ORDER,
      select: { id: true, questionId: true, text: true, textLatn: true, textRu: true },
    });
    const byQuestion = new Map<string, typeof options>();
    for (const o of options) byQuestion.set(o.questionId, [...(byQuestion.get(o.questionId) ?? []), o]);
    const items: AttemptQuestion[] = picked.map((q) => {
      const list = byQuestion.get(q.id) ?? [];
      const locked = isOrderLocked(list);
      return { questionId: q.id, topicId: q.topicId, topicSlug: (q as PoolQuestion & { topicSlug: string }).topicSlug, day: q.day, locked, optionOrder: initialOrder(list.map((o) => o.id), locked) };
    });

    const now = new Date();
    try {
      const attempt = await this.prisma.finalExamAttempt.create({
        data: {
          userId,
          type,
          startedAt: now,
          expiresAt: new Date(now.getTime() + minutes * 60_000),
          totalQuestions: items.length,
          questions: items as unknown as Prisma.InputJsonValue,
        },
      });
      return this.state(attempt);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const other = await this.prisma.finalExamAttempt.findFirst({ where: { userId, type, status: "IN_PROGRESS" }, select: { id: true } });
        throw conflict("FINAL_EXAM_ACTIVE", "Tugallanmagan urinish bor", { attemptId: other?.id });
      }
      throw err;
    }
  }

  private async load(userId: string, id: string): Promise<FinalExamAttempt> {
    const attempt = await this.prisma.finalExamAttempt.findFirst({ where: { id, userId } });
    // Boshqa foydalanuvchining urinishi — mavjud emasdek (404).
    if (!attempt) throw new NotFoundException({ statusCode: 404, code: "FINAL_EXAM_NOT_FOUND", message: "Urinish topilmadi" });
    if (attempt.status === "IN_PROGRESS" && attempt.expiresAt.getTime() < Date.now()) {
      await this.finalize(attempt, "EXPIRED", attempt.expiresAt);
      return this.prisma.finalExamAttempt.findUniqueOrThrow({ where: { id } });
    }
    return attempt;
  }

  /** Urinish holati: taymer, savollar holati, urinish raqami va hozirgi o'rtacha. */
  private async state(a: FinalExamAttempt) {
    const all = await this.counted(a.userId, a.type);
    const index = all.findIndex((x) => x.id === a.id);
    const finishedOthers = all.filter((x) => x.status !== "IN_PROGRESS");
    const answers = answersOf(a);
    const done = a.status !== "IN_PROGRESS";
    const items = questionsOf(a);
    const finishedCount = finishedOthers.length;
    const certificate = done && finishedCount >= FINAL_EXAM_MAX_ATTEMPTS ? await this.prisma.certificate.findUnique({ where: { userId_examType: { userId: a.userId, examType: a.type } } }) : null;
    return {
      ...attemptSummary(a),
      remainingMs: remainingMs(a),
      durationSec: durationSec(a.startedAt, a.finishedAt ?? new Date()),
      limitSec: FINAL_EXAM_TYPES[a.type].minutes * 60,
      attemptNo: index >= 0 ? index + 1 : null,
      archived: a.archivedAt !== null,
      attemptsUsed: all.length,
      maxAttempts: FINAL_EXAM_MAX_ATTEMPTS,
      /** Yakunlangan urinishlar o'rtachasi (shu urinish tugagan bo'lsa — u ham ichida). */
      average: averagePercent(finishedOthers.map((x) => x.scorePercent)),
      finishedAttempts: finishedCount,
      outcome: (finishedCount < FINAL_EXAM_MAX_ATTEMPTS ? "in_progress" : certificate ? "passed" : "failed") as ExamOutcome,
      certificateNumber: certificate?.certificateNumber ?? null,
      items: items.map((q, i) => ({ answered: Boolean(answers[i]), correct: done ? Boolean(q.correct) : null })),
    };
  }

  async get(userId: string, id: string) {
    await this.access.assertCourseAccess(userId);
    return this.state(await this.load(userId, id));
  }

  /** Savollar (urinishdagi tartibda, variantlar saqlangan tartibda). Natija — faqat imtihon tugagach. */
  async questions(userId: string, id: string) {
    await this.access.assertCourseAccess(userId);
    const attempt = await this.load(userId, id);
    const done = attempt.status !== "IN_PROGRESS";
    const items = questionsOf(attempt);
    const answers = answersOf(attempt);
    const rows = await this.prisma.question.findMany({
      where: { id: { in: items.map((q) => q.questionId) } },
      include: { options: { orderBy: OPTION_ORDER }, keywords: done },
    });
    const byId = new Map(rows.map((q) => [q.id, q]));
    return items.flatMap((item, position) => {
      const q = byId.get(item.questionId);
      if (!q) return [];
      const options = new Map(q.options.map((o) => [o.id, o]));
      const ordered = [...item.optionOrder.flatMap((oid) => options.get(oid) ?? []), ...q.options.filter((o) => !item.optionOrder.includes(o.id))];
      const selectedOptionId = answers[position]?.optionId ?? null;
      const correctOption = q.options.find((o) => o.isCorrect);
      return [
        {
          position,
          topicSlug: item.topicSlug,
          selectedOptionId,
          question: {
            id: q.id,
            text: questionText(q),
            imageUrl: q.imageUrl,
            ...(q.imageSmallUrl ? { imageSmallUrl: q.imageSmallUrl } : {}),
            imageWidth: q.imageWidth,
            imageHeight: q.imageHeight,
            options: ordered.map((o) => ({ id: o.id, text: optionText(o) })),
            ...(item.locked ? { orderLocked: true } : {}),
          },
          review: done
            ? {
                selectedOptionId,
                correct: Boolean(selectedOptionId && selectedOptionId === correctOption?.id),
                correctOptionId: correctOption?.id ?? "",
                keyword: toLocalizedText(q.keyword, q.keywordRu),
                keywords: toKeywordsDto(q.keywords ?? null),
                explanation: approvedExplanation(q),
              }
            : null,
        },
      ];
    });
  }

  private assertInProgress(a: FinalExamAttempt): void {
    if (a.status === "EXPIRED") throw conflict("FINAL_EXAM_TIME_UP", "Vaqt tugadi — imtihon avtomatik yakunlandi");
    if (a.status === "FINISHED") throw conflict("FINAL_EXAM_FINISHED", "Imtihon yakunlangan");
  }

  /** Javob: faqat vaqt ichida, bir savolga bir marta. Natija (to'g'ri/xato) qaytmaydi. */
  async answer(userId: string, id: string, position: number, optionId: string) {
    await this.access.assertCourseAccess(userId);
    const attempt = await this.load(userId, id);
    this.assertInProgress(attempt);
    const item = questionsOf(attempt)[position];
    if (!item) throw new NotFoundException({ statusCode: 404, code: "FINAL_EXAM_NOT_FOUND", message: "Savol topilmadi" });
    if (!item.optionOrder.includes(optionId)) {
      const belongs = await this.prisma.option.count({ where: { id: optionId, questionId: item.questionId } });
      if (!belongs) throw new BadRequestException("Variant ushbu savolga tegishli emas");
    }
    const key = String(position);
    const value = JSON.stringify({ optionId, answeredAt: new Date().toISOString() });
    // Atomar: faqat faol, muddati o'tmagan va shu savolga hali javob berilmagan bo'lsa.
    const saved = await this.prisma.$executeRaw`
      UPDATE "FinalExamAttempt"
      SET "answers" = "answers" || jsonb_build_object(${key}::text, ${value}::jsonb)
      WHERE "id" = ${id} AND "status" = 'IN_PROGRESS' AND "expiresAt" >= now() AND NOT ("answers" ? ${key}::text)`;
    let fresh = await this.load(userId, id);
    if (saved === 0) {
      this.assertInProgress(fresh);
      if (fresh.expiresAt.getTime() < Date.now()) throw conflict("FINAL_EXAM_TIME_UP", "Vaqt tugadi");
      throw conflict("FINAL_EXAM_ALREADY_ANSWERED", "Bu savolga javob berilgan");
    }
    // Hamma savolga javob berildi — imtihon o'zi yakunlanadi.
    if (Object.keys(answersOf(fresh)).length >= fresh.totalQuestions && fresh.status === "IN_PROGRESS") {
      await this.finalize(fresh, "FINISHED", new Date());
      fresh = await this.prisma.finalExamAttempt.findUniqueOrThrow({ where: { id } });
    }
    return this.state(fresh);
  }

  /**
   * Javob berilmay tashlab ketilgan savol: variantlar qayta aralashtiriladi (har biri
   * boshqa joyga) va saqlanadi — qaytganda boshqa tartib. Qulflangan savolda o'zgarmaydi.
   */
  async skip(userId: string, id: string, position: number) {
    await this.access.assertCourseAccess(userId);
    const attempt = await this.load(userId, id);
    this.assertInProgress(attempt);
    const item = questionsOf(attempt)[position];
    if (!item) throw new NotFoundException({ statusCode: 404, code: "FINAL_EXAM_NOT_FOUND", message: "Savol topilmadi" });
    if (item.locked || answersOf(attempt)[position]) return { position, optionOrder: item.optionOrder };
    const next = reshuffle(item.optionOrder);
    const path = `{${position},optionOrder}`;
    await this.prisma.$executeRaw`
      UPDATE "FinalExamAttempt"
      SET "questions" = jsonb_set("questions", ${path}::text[], ${JSON.stringify(next)}::jsonb)
      WHERE "id" = ${id} AND "status" = 'IN_PROGRESS' AND NOT ("answers" ? ${String(position)}::text)`;
    const fresh = await this.prisma.finalExamAttempt.findUniqueOrThrow({ where: { id } });
    return { position, optionOrder: questionsOf(fresh)[position].optionOrder };
  }

  /** "Yakunlash": javobsizlar xato. Vaqt o'tgan bo'lsa — EXPIRED. */
  async finish(userId: string, id: string) {
    await this.access.assertCourseAccess(userId);
    const attempt = await this.load(userId, id);
    if (attempt.status === "IN_PROGRESS") await this.finalize(attempt, "FINISHED", new Date());
    return this.state(await this.prisma.finalExamAttempt.findUniqueOrThrow({ where: { id } }));
  }

  // ── Sertifikatlar ──

  private certificateDto(c: { certificateNumber: string; examType: FinalExamType; averagePercent: number; attemptsCount: number; fullName: string; letterText: string; letterTone: string; issuedAt: Date; celebratedAt: Date | null }) {
    return {
      certificateNumber: c.certificateNumber,
      examType: c.examType,
      questions: FINAL_EXAM_TYPES[c.examType].questions,
      averagePercent: c.averagePercent,
      attemptsCount: c.attemptsCount,
      fullName: c.fullName,
      letterText: c.letterText,
      letterTone: c.letterTone,
      issuedAt: c.issuedAt,
      celebrated: c.celebratedAt !== null,
    };
  }

  async certificates(userId: string) {
    await this.access.assertCourseAccess(userId);
    const rows = await this.prisma.certificate.findMany({ where: { userId }, orderBy: { issuedAt: "asc" } });
    return rows.map((c) => this.certificateDto(c));
  }

  private async ownCertificate(userId: string, number: string) {
    const c = await this.prisma.certificate.findFirst({ where: { userId, certificateNumber: number } });
    if (!c) throw new NotFoundException({ statusCode: 404, code: "CERTIFICATE_NOT_FOUND", message: "Sertifikat topilmadi" });
    return c;
  }

  async certificate(userId: string, number: string) {
    await this.access.assertCourseAccess(userId);
    return this.certificateDto(await this.ownCertificate(userId, number));
  }

  /** Ism profilda bo'lmagan — o'quvchi bir marta kiritadi (keyin o'zgarmaydi). */
  async setCertificateName(userId: string, number: string, fullName: string) {
    await this.access.assertCourseAccess(userId);
    const c = await this.ownCertificate(userId, number);
    if (c.fullName) throw conflict("CERTIFICATE_NAME_SET", "Sertifikatdagi ism allaqachon kiritilgan");
    const name = fullName.trim().replace(/\s+/g, " ");
    if (name.length < 3) throw new BadRequestException("Ism va familiyani to'liq kiriting");
    await this.prisma.certificate.updateMany({ where: { id: c.id, fullName: "" }, data: { fullName: name } });
    return this.certificateDto(await this.ownCertificate(userId, number));
  }

  /** Tabrik ekrani ko'rildi — keyingi kirishda avtomatik chiqmaydi. */
  async markCelebrated(userId: string, number: string) {
    await this.access.assertCourseAccess(userId);
    const c = await this.ownCertificate(userId, number);
    if (!c.celebratedAt) await this.prisma.certificate.update({ where: { id: c.id }, data: { celebratedAt: new Date() } });
    return { ok: true };
  }

  /** Ommaviy tekshirish: faqat ism, natija, sana va tur. */
  async verify(number: string) {
    const c = await this.prisma.certificate.findUnique({ where: { certificateNumber: number } });
    if (!c) throw new NotFoundException({ statusCode: 404, code: "CERTIFICATE_NOT_FOUND", message: "Sertifikat topilmadi" });
    return {
      certificateNumber: c.certificateNumber,
      fullName: c.fullName,
      examType: c.examType,
      questions: FINAL_EXAM_TYPES[c.examType].questions,
      averagePercent: c.averagePercent,
      attemptsCount: c.attemptsCount,
      issuedAt: c.issuedAt,
    };
  }

  // ── Admin ──

  async adminList(query: { q?: string; page: number; pageSize: number }) {
    await this.expireOverdue();
    const where: Prisma.UserWhereInput = { finalExamAttempts: { some: {} }, ...(query.q?.trim() ? userSearch(query.q) : {}) };
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          ...userBrief,
          finalExamAttempts: { where: COUNTED, orderBy: { startedAt: "asc" }, select: { type: true, status: true, scorePercent: true, startedAt: true } },
          certificates: { select: { examType: true, certificateNumber: true, averagePercent: true } },
        },
      }),
    ]);
    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      items: users.map(({ finalExamAttempts, certificates, ...user }) => ({
        user,
        lastStartedAt: finalExamAttempts.at(-1)?.startedAt ?? null,
        types: (["Q20", "Q50"] as const).map((type) => {
          const list = finalExamAttempts.filter((a) => a.type === type);
          const cert = certificates.find((c) => c.examType === type);
          return {
            type,
            attemptsUsed: list.length,
            average: averagePercent(list.filter((a) => a.status !== "IN_PROGRESS").map((a) => a.scorePercent)),
            certificateNumber: cert?.certificateNumber ?? null,
          };
        }),
      })),
    };
  }

  async adminUser(userId: string) {
    await this.expireOverdue(userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: userBrief });
    if (!user) throw new NotFoundException("Foydalanuvchi topilmadi");
    const [attempts, certificates, lock] = await Promise.all([
      this.prisma.finalExamAttempt.findMany({ where: { userId }, orderBy: { startedAt: "asc" } }),
      this.prisma.certificate.findMany({ where: { userId } }),
      this.examLock(userId),
    ]);
    return {
      user,
      unlocked: lock.unlocked,
      remainingTopics: lock.remainingTopics,
      types: (["Q20", "Q50"] as const).map((type) => {
        const list = attempts.filter((a) => a.type === type && a.archivedAt === null);
        const cert = certificates.find((c) => c.examType === type);
        return {
          type,
          ...FINAL_EXAM_TYPES[type],
          maxAttempts: FINAL_EXAM_MAX_ATTEMPTS,
          attemptsUsed: list.length,
          average: averagePercent(list.filter((a) => a.status !== "IN_PROGRESS").map((a) => a.scorePercent)),
          attempts: list.map(attemptSummary),
          archivedCount: attempts.filter((a) => a.type === type && a.archivedAt !== null).length,
          certificate: cert ? { certificateNumber: cert.certificateNumber, averagePercent: cert.averagePercent, issuedAt: cert.issuedAt, fullName: cert.fullName } : null,
        };
      }),
    };
  }

  /**
   * Admin: yakunlangan urinish savollari — o'quvchi javobi, to'g'ri javob va natija
   * (xato / javobsiz). Faol urinishda 409: imtihon davomida javoblar ko'rsatilmaydi.
   */
  async adminAttempt(attemptId: string) {
    await this.expireOverdue();
    const attempt = await this.prisma.finalExamAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException({ statusCode: 404, code: "FINAL_EXAM_NOT_FOUND", message: "Urinish topilmadi" });
    if (attempt.status === "IN_PROGRESS") throw conflict("FINAL_EXAM_IN_PROGRESS", "Urinish hali yakunlanmagan");
    const items = questionsOf(attempt);
    const answers = answersOf(attempt);
    const rows = await this.prisma.question.findMany({
      where: { id: { in: items.map((q) => q.questionId) } },
      include: { options: { orderBy: OPTION_ORDER }, topic: { select: { slug: true, title: true } } },
    });
    const byId = new Map(rows.map((q) => [q.id, q]));
    return {
      ...attemptSummary(attempt),
      userId: attempt.userId,
      questions: items.map((item, position) => {
        const q = byId.get(item.questionId);
        const selectedOptionId = answers[position]?.optionId ?? null;
        const correctOptionId = q?.options.find((o) => o.isCorrect)?.id ?? null;
        const options = q ? new Map(q.options.map((o) => [o.id, o])) : new Map();
        const ordered = q ? [...item.optionOrder.flatMap((oid) => options.get(oid) ?? []), ...q.options.filter((o) => !item.optionOrder.includes(o.id))] : [];
        return {
          position,
          questionId: item.questionId,
          topicSlug: item.topicSlug,
          topicTitle: q?.topic.title ?? null,
          day: item.day,
          /** Savol bazadan o'chirilgan bo'lsa — matn yo'q. */
          text: q ? questionText(q) : null,
          imageUrl: q?.imageUrl ?? null,
          options: ordered.map((o) => ({ id: o.id, text: optionText(o) })),
          selectedOptionId,
          correctOptionId,
          answeredAt: answers[position]?.answeredAt ?? null,
          result: !selectedOptionId ? "skipped" : item.correct ? "correct" : "wrong",
        };
      }),
    };
  }

  /**
   * Urinishlarni nolga qaytarish: shu turdagi urinishlar arxivlanadi (tarix saqlanadi,
   * hisobga olinmaydi), faol urinish yopiladi. Berilgan sertifikat o'zgarmaydi.
   */
  async adminReset(admin: AdminUser, ip: string, userId: string, type: FinalExamType) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException("Foydalanuvchi topilmadi");
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.finalExamAttempt.updateMany({ where: { userId, type, status: "IN_PROGRESS" }, data: { status: "EXPIRED", finishedAt: now } });
      const archived = await tx.finalExamAttempt.updateMany({ where: { userId, type, archivedAt: null }, data: { archivedAt: now } });
      await this.audit.log(admin, ip, { action: "final_exam.reset", entityType: "user", entityId: userId, after: { type, archived: archived.count } }, tx);
      return archived.count;
    });
    return { userId, type, archived: result };
  }
}
