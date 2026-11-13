import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LessonsService } from "../lessons/lessons.service";
import { toLocalizedText } from "../common/localized-text";
import { toKeywordsDto, approvedExplanation } from "../common/question-content";
import { CheckAnswerResultDto } from "./dto/check-answer.dto";

/**
 * Admin o'chirgan savol shu vaqt ichida hali javob tekshiruvidan o'tadi: test
 * savollari boshlanishida bir marta olinadi, shuning uchun o'chirishdan oldin
 * boshlangan (tugallanmagan) test buzilmay tugaydi. Ro'yxatlarda u darhol yo'q.
 */
export const DELETED_GRACE_MS = 6 * 3600_000;

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

    // Javobi hali belgilanmagan savol testda yo'q — tekshirib ham bo'lmaydi.
    const deletedLongAgo = question?.deletedAt && Date.now() - question.deletedAt.getTime() > DELETED_GRACE_MS;
    if (!question || deletedLongAgo || question.answerPending || !question.options.some((o) => o.isCorrect)) {
      throw new NotFoundException(`Savol topilmadi: ${questionId}`);
    }
    // Testga kirish huquqi bo'lmasa, javob ham tekshirilmaydi (video sharti va h.k.).
    await this.lessons.assertTopicUnlocked(question.topic.slug, userId, { allowEverCompleted: true });

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

    // Statistika uchun (eng ko'p xato qilinadigan savollar) — javobni sekinlatmaydi.
    this.prisma.answerLog
      .create({ data: { userId, questionId: question.id, correct: submittedOption.isCorrect } })
      .catch(() => undefined);

    return new CheckAnswerResultDto(
      submittedOption.isCorrect,
      correctOption.id,
      toLocalizedText(question.keyword, question.keywordRu),
      toKeywordsDto(question.keywords),
      approvedExplanation(question),
    );
  }
}
