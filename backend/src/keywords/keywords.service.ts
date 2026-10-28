import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { toLocalizedText } from "../common/localized-text";
import { OPTION_ORDER, optionText, questionText, toKeywordsDto } from "../common/question-content";
import type { KeywordListDto, ReviewResultDto } from "./dto/keywords.dto";

@Injectable()
export class KeywordsService {
  constructor(private readonly prisma: PrismaService) {}

  private async topicId(slug: string): Promise<string> {
    const topic = await this.prisma.topic.findUnique({ where: { slug }, select: { id: true } });
    if (!topic) throw new NotFoundException(`Mavzu topilmadi: ${slug}`);
    return topic.id;
  }

  /** Mavzuning BARCHA test savollari — kalit so'zi yo'qlari ham (`keywords: null`). */
  async list(userId: string, slug: string): Promise<KeywordListDto> {
    const topicId = await this.topicId(slug);
    const questions = await this.prisma.question.findMany({
      where: { topicId, deletedAt: null },
      orderBy: { order: "asc" },
      include: {
        options: { orderBy: OPTION_ORDER },
        keywords: true,
        keywordReviews: { where: { userId }, select: { questionId: true } },
      },
    });

    const items = questions.map((q) => {
      const correct = q.options.find((o) => o.isCorrect);
      const explanation = q.explanation ? toLocalizedText(q.explanation, q.explanationRu, q.explanationLatn) : null;
      return {
        id: q.id,
        order: q.order,
        text: questionText(q),
        imageUrl: q.imageUrl,
        imageWidth: q.imageWidth,
        imageHeight: q.imageHeight,
        correctAnswer: correct ? optionText(correct) : null,
        explanation,
        keywords: toKeywordsDto(q.keywords),
        reviewed: q.keywordReviews.length > 0,
      };
    });
    return { total: items.length, reviewedCount: items.filter((i) => i.reviewed).length, items };
  }

  /** Idempotent: qayta belgilash/olib tashlash xato bermaydi. */
  async setReviewed(userId: string, slug: string, questionId: string, reviewed: boolean): Promise<ReviewResultDto> {
    const topicId = await this.topicId(slug);
    const question = await this.prisma.question.findFirst({ where: { id: questionId, topicId, deletedAt: null }, select: { id: true } });
    if (!question) throw new NotFoundException(`Savol topilmadi: ${questionId}`);

    if (reviewed) {
      await this.prisma.keywordReview.upsert({
        where: { userId_questionId: { userId, questionId } },
        update: {},
        create: { userId, questionId },
      });
    } else {
      await this.prisma.keywordReview.deleteMany({ where: { userId, questionId } });
    }

    const [total, reviewedCount] = await Promise.all([
      this.prisma.question.count({ where: { topicId, deletedAt: null } }),
      this.prisma.keywordReview.count({ where: { userId, question: { topicId, deletedAt: null } } }),
    ]);
    return { questionId, reviewed, total, reviewedCount };
  }
}
