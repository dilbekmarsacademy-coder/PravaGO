import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OPTION_ORDER, optionText, questionText } from "../common/question-content";
import { PublicOptionDto, PublicQuestionDto } from "./dto/public-question.dto";

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicQuestions(slug: string): Promise<PublicQuestionDto[]> {
    const topic = await this.prisma.topic.findUnique({
      where: { slug },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: { options: { orderBy: OPTION_ORDER } },
        },
      },
    });

    if (!topic) {
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
}
