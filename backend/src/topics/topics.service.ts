import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { toLocalizedText } from "../common/localized-text";
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
          include: { options: { orderBy: { createdAt: "asc" } } },
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
          text: toLocalizedText(q.text, q.textRu),
          imageUrl: q.imageUrl,
          imageWidth: q.imageWidth,
          imageHeight: q.imageHeight,
          options: q.options.map((o) => new PublicOptionDto(o.id, toLocalizedText(o.text, o.textRu))),
        }),
    );
  }
}
