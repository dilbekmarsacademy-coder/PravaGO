import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OPTION_ORDER, STUDENT_QUESTION_WHERE, optionText, questionText } from "../common/question-content";
import { PublicOptionDto, PublicQuestionDto } from "./dto/public-question.dto";

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicQuestions(slug: string): Promise<PublicQuestionDto[]> {
    const topic = await this.prisma.topic.findUnique({
      where: { slug },
      include: {
        questions: {
          where: STUDENT_QUESTION_WHERE,
          orderBy: { order: "asc" },
          include: { options: { orderBy: OPTION_ORDER } },
        },
      },
    });

    if (!topic || topic.deletedAt) {
      throw new NotFoundException(`Mavzu topilmadi: ${slug}`);
    }

    return topic.questions.map(
      (q) =>
        new PublicQuestionDto({
          id: q.id,
          text: questionText(q),
          imageUrl: q.imageUrl,
          imageWidth: q.imageWidth,
          imageHeight: q.imageHeight,
          options: q.options.map((o) => new PublicOptionDto(o.id, optionText(o))),
        }),
    );
  }

  /**
   * Kurs mavzulari bo'yicha testda qatnashadigan (javobi belgilangan) savollar
   * soni: { "day4-topic1": 0, ... }. Kabinet shu bilan savol sonini ko'rsatadi
   * va savoli yo'q testni ketma-ketlikda to'siq qilmaydi. Faqat sonlar.
   */
  async readyCounts(): Promise<Record<string, number>> {
    const topics = await this.prisma.topic.findMany({
      where: { kind: "course", deletedAt: null },
      select: { slug: true, _count: { select: { questions: { where: STUDENT_QUESTION_WHERE } } } },
    });
    return Object.fromEntries(topics.map((t) => [t.slug, t._count.questions]));
  }
}
