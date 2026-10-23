import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LessonsService } from "../lessons/lessons.service";
import { toLocalizedText } from "../common/localized-text";
import { toKeywordsDto } from "../common/question-content";
import { CheckAnswerResultDto } from "./dto/check-answer.dto";

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lessons: LessonsService,
  ) {}

  async checkAnswer(questionId: string, optionId: string, userId: string): Promise<CheckAnswerResultDto> {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { options: true, keywords: true, topic: { select: { slug: true } } },
    });

    if (!question) {
      throw new NotFoundException(`Savol topilmadi: ${questionId}`);
    }
    // Testga kirish huquqi bo'lmasa, javob ham tekshirilmaydi (video sharti va h.k.).
    await this.lessons.assertTopicUnlocked(question.topic.slug, userId);

    const submittedOption = question.options.find((o) => o.id === optionId);
    if (!submittedOption) {
      throw new BadRequestException(`Variant ushbu savolga tegishli emas: ${optionId}`);
    }

    const correctOption = question.options.find((o) => o.isCorrect);
    if (!correctOption) {
      throw new BadRequestException(
        `Savol #${question.order} uchun to'g'ri javob hali belgilanmagan (needsReview).`,
      );
    }

    return new CheckAnswerResultDto(
      submittedOption.isCorrect,
      correctOption.id,
      toLocalizedText(question.keyword, question.keywordRu),
      toKeywordsDto(question.keywords),
    );
  }
}
