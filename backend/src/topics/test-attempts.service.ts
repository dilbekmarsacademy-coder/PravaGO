import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AttemptAnswerDto, TestAttemptDto } from "./dto/test-attempt.dto";

@Injectable()
export class TestAttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * To'liq mavzu testi natijasini saqlaydi. Foiz klientdan olinmaydi: har bir
   * javob bazadagi to'g'ri variant bilan solishtiriladi, mavzudan tashqari
   * savollar va takroriy javoblar hisobga olinmaydi; maxraj — mavzudagi barcha savollar.
   */
  async create(userId: string, slug: string, answers: AttemptAnswerDto[]): Promise<TestAttemptDto> {
    const topic = await this.prisma.topic.findUnique({
      where: { slug },
      select: { id: true, questions: { where: { deletedAt: null }, select: { id: true, options: { where: { isCorrect: true }, select: { id: true } } } } },
    });
    if (!topic) throw new NotFoundException(`Mavzu topilmadi: ${slug}`);

    const correctByQuestion = new Map(topic.questions.map((q) => [q.id, q.options[0]?.id]));
    const seen = new Set<string>();
    let correct = 0;
    for (const answer of answers) {
      if (seen.has(answer.questionId) || !correctByQuestion.has(answer.questionId)) continue;
      seen.add(answer.questionId);
      if (correctByQuestion.get(answer.questionId) === answer.optionId) correct++;
    }
    const total = topic.questions.length;
    const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
    const row = await this.prisma.topicTestAttempt.create({
      data: { userId, topicId: topic.id, correct, total, percent },
    });
    return { topicSlug: slug, correct, total, percent, createdAt: row.createdAt };
  }

  /** Foydalanuvchining barcha urinishlari (eskidan yangiga) — kabinet progressi uchun. */
  async list(userId: string): Promise<TestAttemptDto[]> {
    const rows = await this.prisma.topicTestAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      take: 2000,
      include: { topic: { select: { slug: true } } },
    });
    return rows.map((r) => ({ topicSlug: r.topic.slug, correct: r.correct, total: r.total, percent: r.percent, createdAt: r.createdAt }));
  }
}
