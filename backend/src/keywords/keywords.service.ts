import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AccessService } from "../access/access.service";
import { toLocalizedText } from "../common/localized-text";
import { OPTION_ORDER, STUDENT_QUESTION_WHERE, approvedExplanation, optionText, questionText, toKeywordsDto } from "../common/question-content";
import type { KeywordListDto, KeywordProgressDto, ReviewResultDto, TopicFlowDto } from "./dto/keywords.dto";

/** Oqim yoqilgan foydalanuvchiga test yopiq bo'lganda ko'rsatiladigan matn. */
export const FLOW_LOCKED_MESSAGE = "Avval videoni ko'ring va kalit so'zlar bilan tanishing";

@Injectable()
export class KeywordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  private async topicId(slug: string): Promise<string> {
    const topic = await this.prisma.topic.findUnique({ where: { slug }, select: { id: true } });
    if (!topic) throw new NotFoundException(`Mavzu topilmadi: ${slug}`);
    return topic.id;
  }

  /** Mavzuning BARCHA test savollari — kalit so'zi yo'qlari ham (`keywords: null`). */
  async list(userId: string, slug: string): Promise<KeywordListDto> {
    const topicId = await this.topicId(slug);
    const questions = await this.prisma.question.findMany({
      where: { topicId, ...STUDENT_QUESTION_WHERE },
      orderBy: { order: "asc" },
      include: {
        options: { orderBy: OPTION_ORDER },
        keywords: true,
        keywordReviews: { where: { userId }, select: { questionId: true } },
      },
    });

    const items = questions.map((q) => {
      const correct = q.options.find((o) => o.isCorrect);
      const explanation = approvedExplanation(q);
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
    return { total: items.length, reviewedCount: items.filter((i) => i.reviewed).length, items, ...(await this.flow(userId, topicId)) };
  }

  /** Tanishib chiqilgan savollar soni va oqim holati — test darvozasi uchun (faqat sonlar). */
  async progress(userId: string, slug: string): Promise<KeywordProgressDto> {
    const topicId = await this.topicId(slug);
    const [counts, flow] = await Promise.all([this.counts(userId, topicId), this.flow(userId, topicId)]);
    return { ...counts, ...flow };
  }

  private async flow(userId: string, topicId: string): Promise<TopicFlowDto> {
    const [flags, view] = await Promise.all([
      this.access.flowFlags(userId),
      this.prisma.topicKeywordsView.findUnique({ where: { userId_topicId: { userId, topicId } }, select: { viewedAt: true } }),
    ]);
    return { gated: flags.gated, unlockAll: flags.unlockAll, viewed: view !== null, viewedAt: view?.viewedAt ?? null };
  }

  /**
   * "Tanishib chiqdim": kalit so'zlar sahifasi oxirigacha ko'rildi (tugma
   * sahifa oxiriga yetilgandagina yoqiladi). Idempotent — birinchi vaqt saqlanadi.
   * Kirish huquqi (video ko'rilgan) controller'da tekshiriladi.
   */
  async markViewed(userId: string, slug: string): Promise<KeywordProgressDto> {
    if (slug.startsWith("new-")) throw new NotFoundException(`Mavzu topilmadi: ${slug}`);
    const topicId = await this.topicId(slug);
    await this.prisma.topicKeywordsView.upsert({
      where: { userId_topicId: { userId, topicId } },
      update: {},
      create: { userId, topicId },
    });
    return this.progress(userId, slug);
  }

  private async counts(userId: string, topicId: string): Promise<{ total: number; reviewedCount: number }> {
    const [total, reviewedCount] = await Promise.all([
      this.prisma.question.count({ where: { topicId, ...STUDENT_QUESTION_WHERE } }),
      this.prisma.keywordReview.count({ where: { userId, question: { topicId, ...STUDENT_QUESTION_WHERE } } }),
    ]);
    return { total, reviewedCount };
  }

  /**
   * Kun mavzusi testi barcha savollar (to'g'ri javobi va kalit so'zlari) bilan
   * "Tanishdim" bosilgach ochiladi — aks holda 403 KEYWORDS_NOT_REVIEWED.
   * "Yangi testlar" to'plamlarida bu shart yo'q.
   */
  async assertReviewed(userId: string, slug: string): Promise<void> {
    if (slug.startsWith("new-")) return;
    const flags = await this.access.flowFlags(userId);
    // Admin ochib qo'ygan o'quvchi — kalit so'zlar bilan tanishmasdan ham test ochiq.
    if (flags.unlockAll) return;
    const topic = await this.prisma.topic.findUnique({ where: { slug }, select: { id: true } });
    if (!topic) return; // topilmagan mavzu — savollar endpointi o'zi 404 qaytaradi
    if (flags.gated) {
      // Yangi oqim: sahifa oxirigacha ko'rilib "Tanishib chiqdim" bosilgan bo'lishi shart.
      const viewed = await this.prisma.topicKeywordsView.count({ where: { userId, topicId: topic.id } });
      if (viewed === 0) {
        throw new ForbiddenException({ statusCode: 403, code: "KEYWORDS_NOT_REVIEWED", flow: true, message: FLOW_LOCKED_MESSAGE });
      }
      return;
    }
    const { total, reviewedCount } = await this.counts(userId, topic.id);
    if (reviewedCount < total) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "KEYWORDS_NOT_REVIEWED",
        total,
        reviewedCount,
        message: "Testni ochish uchun avval barcha savollar va kalit so'zlar bilan tanishib chiqing",
      });
    }
  }

  /** Idempotent: qayta belgilash/olib tashlash xato bermaydi. */
  async setReviewed(userId: string, slug: string, questionId: string, reviewed: boolean): Promise<ReviewResultDto> {
    const topicId = await this.topicId(slug);
    const question = await this.prisma.question.findFirst({ where: { id: questionId, topicId, ...STUDENT_QUESTION_WHERE }, select: { id: true } });
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

    return { questionId, reviewed, ...(await this.counts(userId, topicId)) };
  }
}
