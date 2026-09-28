import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { toLocalizedText } from "../common/localized-text";
import { PublicOptionDto, PublicQuestionDto } from "../topics/dto/public-question.dto";
import type {
  CreateSavedDto,
  ListSavedQueryDto,
  SavedCountDto,
  SavedItemDto,
  SavedListDto,
  SavedRecordDto,
} from "./dto/saved.dto";

/** Bitta foydalanuvchi saqlashi mumkin bo'lgan savollar soni. */
export const SAVED_LIMIT = 1000;
const DEFAULT_PAGE_SIZE = 20;

export class PracticeQuestionDto extends PublicQuestionDto {
  topicSlug: string;
}

const recordSelect = {
  questionId: true,
  sourceMode: true,
  attemptId: true,
  note: true,
  createdAt: true,
  topic: { select: { slug: true } },
} satisfies Prisma.SavedQuestionSelect;

type RecordRow = Prisma.SavedQuestionGetPayload<{ select: typeof recordSelect }>;

function toRecord(row: RecordRow): SavedRecordDto {
  return {
    questionId: row.questionId,
    topicSlug: row.topic.slug,
    sourceMode: row.sourceMode,
    attemptId: row.attemptId,
    note: row.note,
    createdAt: row.createdAt,
  };
}

// Kursor: oxirgi elementning (createdAt, id) jufti — sahifalar orasida yangi
// saqlangan savollar qo'shilsa ham takror/tushib qolish bo'lmaydi.
function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify([createdAt.toISOString(), id])).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const [iso, id] = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as [string, string];
    const createdAt = new Date(iso);
    if (typeof id !== "string" || Number.isNaN(createdAt.getTime())) throw new Error("bad cursor");
    return { createdAt, id };
  } catch {
    throw new BadRequestException("Kursor noto'g'ri");
  }
}

@Injectable()
export class SavedService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Savolni saqlaydi. Idempotent: allaqachon saqlangan bo'lsa mavjud yozuv
   * `created: false` bilan qaytadi.
   */
  async save(userId: string, dto: CreateSavedDto): Promise<{ record: SavedRecordDto; created: boolean }> {
    const existing = await this.findRecord(userId, dto.questionId);
    if (existing) return { record: existing, created: false };

    const question = await this.prisma.question.findUnique({
      where: { id: dto.questionId },
      select: { id: true, topicId: true },
    });
    if (!question) throw new NotFoundException(`Savol topilmadi: ${dto.questionId}`);
    // Pullik kontent/tarif tizimi paydo bo'lganda ruxsat tekshiruvi shu yerga qo'shiladi
    // (hozir barcha savollar ochiq — GET /topics/:slug/questions ham auth talab qilmaydi).

    const attemptId = dto.sourceMode === "exam" ? dto.attemptId ?? null : null;
    if (attemptId) {
      const attempt = await this.prisma.examAttempt.findFirst({ where: { id: attemptId, userId } });
      // Boshqa foydalanuvchining urinishi ham "topilmadi" — mavjudligini oshkor qilmaymiz.
      if (!attempt) throw new NotFoundException(`Urinish topilmadi: ${attemptId}`);
    }

    const count = await this.prisma.savedQuestion.count({ where: { userId } });
    if (count >= SAVED_LIMIT) {
      throw new ConflictException({
        statusCode: 409,
        error: "Conflict",
        code: "SAVED_LIMIT_REACHED",
        message: `Ko'pi bilan ${SAVED_LIMIT} ta savol saqlash mumkin. Avval keraksizlarini olib tashlang.`,
      });
    }

    try {
      const row = await this.prisma.savedQuestion.create({
        data: {
          userId,
          questionId: question.id,
          topicId: question.topicId,
          sourceMode: dto.sourceMode,
          attemptId,
        },
        select: recordSelect,
      });
      return { record: toRecord(row), created: true };
    } catch (err) {
      // Parallel ikki so'rov: ikkinchisi UNIQUE(userId, questionId) ga uriladi.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const record = await this.findRecord(userId, dto.questionId);
        if (record) return { record, created: false };
      }
      throw err;
    }
  }

  /** Idempotent: yozuv bo'lmasa ham xato bermaydi. */
  async remove(userId: string, questionId: string): Promise<void> {
    await this.prisma.savedQuestion.deleteMany({ where: { userId, questionId } });
  }

  async updateNote(userId: string, questionId: string, note: string | null): Promise<SavedRecordDto> {
    const value = note?.trim() ? note.trim() : null;
    const { count } = await this.prisma.savedQuestion.updateMany({
      where: { userId, questionId },
      data: { note: value },
    });
    if (count === 0) throw new NotFoundException(`Saqlangan savol topilmadi: ${questionId}`);
    return (await this.findRecord(userId, questionId)) as SavedRecordDto;
  }

  async ids(userId: string, topicSlug?: string): Promise<string[]> {
    const rows = await this.prisma.savedQuestion.findMany({
      where: { userId, ...(topicSlug ? { topic: { slug: topicSlug } } : {}) },
      select: { questionId: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => row.questionId);
  }

  async count(userId: string): Promise<SavedCountDto> {
    const groups = await this.prisma.savedQuestion.groupBy({
      by: ["topicId"],
      where: { userId },
      _count: { _all: true },
    });
    const topics = await this.prisma.topic.findMany({
      where: { id: { in: groups.map((g) => g.topicId) } },
      select: { id: true, slug: true },
    });
    const slugById = new Map(topics.map((topic) => [topic.id, topic.slug]));
    const byTopic = groups
      .map((g) => ({ topicSlug: slugById.get(g.topicId) ?? "", count: g._count._all }))
      .filter((g) => g.topicSlug)
      .sort((a, b) => a.topicSlug.localeCompare(b.topicSlug));
    return {
      total: byTopic.reduce((sum, g) => sum + g.count, 0),
      limit: SAVED_LIMIT,
      byTopic,
    };
  }

  async list(userId: string, query: ListSavedQueryDto): Promise<SavedListDto> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const newestFirst = (query.sort ?? "new") === "new";
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const direction = newestFirst ? "lt" : "gt";

    const where: Prisma.SavedQuestionWhereInput = {
      userId,
      ...(query.topicSlug ? { topic: { slug: query.topicSlug } } : {}),
      ...(query.q ? { question: this.searchFilter(query.q, query.lang) } : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { [direction]: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { [direction]: cursor.id } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.savedQuestion.findMany({
      where,
      orderBy: [{ createdAt: newestFirst ? "desc" : "asc" }, { id: newestFirst ? "desc" : "asc" }],
      take: limit + 1,
      select: {
        ...recordSelect,
        id: true,
        attempt: { select: { finishedAt: true } },
        question: {
          include: { options: { orderBy: { createdAt: "asc" } } },
        },
      },
    });

    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor = rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null;

    const items = page.map((row): SavedItemDto => {
      const q = row.question;
      // Imtihon urinishi hali yakunlanmagan — javob va kalit so'z umuman yuborilmaydi.
      const answerLocked = row.sourceMode === "exam" && row.attempt !== null && row.attempt.finishedAt === null;
      const item: SavedItemDto = {
        ...toRecord(row),
        question: {
          order: q.order,
          text: toLocalizedText(q.text, q.textRu),
          imageUrl: q.imageUrl,
          imageWidth: q.imageWidth,
          imageHeight: q.imageHeight,
          options: q.options.map((o) => ({ id: o.id, text: toLocalizedText(o.text, o.textRu) })),
        },
        answerLocked,
      };
      if (!answerLocked) {
        const correct = q.options.find((o) => o.isCorrect);
        if (correct) item.correctOptionId = correct.id;
        item.keyword = toLocalizedText(q.keyword, q.keywordRu);
      }
      return item;
    });

    return { items, nextCursor };
  }

  /**
   * "Saqlanganlarni test qilib ishlash" uchun savollar — test API bilan bir xil
   * ochiq format (to'g'ri javob va kalit so'zsiz). Tekshiruv odatiy check-answer orqali.
   */
  async practiceQuestions(userId: string, topicSlug?: string): Promise<PracticeQuestionDto[]> {
    const rows = await this.prisma.savedQuestion.findMany({
      where: {
        userId,
        ...(topicSlug ? { topic: { slug: topicSlug } } : {}),
        // Yakunlanmagan imtihon savollari mashqqa kirmaydi (javob hali yopiq).
        NOT: { sourceMode: "exam", attempt: { is: { finishedAt: null } } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        topic: { select: { slug: true } },
        question: { include: { options: { orderBy: { createdAt: "asc" } } } },
      },
    });

    return rows.map(({ topic, question: q }) => {
      const dto = new PracticeQuestionDto({
        id: q.id,
        text: toLocalizedText(q.text, q.textRu),
        imageUrl: q.imageUrl,
        imageWidth: q.imageWidth,
        imageHeight: q.imageHeight,
        options: q.options.map((o) => new PublicOptionDto(o.id, toLocalizedText(o.text, o.textRu))),
      });
      dto.topicSlug = topic.slug;
      return dto;
    });
  }

  private async findRecord(userId: string, questionId: string): Promise<SavedRecordDto | null> {
    const row = await this.prisma.savedQuestion.findUnique({
      where: { userId_questionId: { userId, questionId } },
      select: recordSelect,
    });
    return row ? toRecord(row) : null;
  }

  /** Savol matni bo'yicha qidiruv (rus tilida — ruscha tarjima ham). */
  private searchFilter(q: string, lang: ListSavedQueryDto["lang"]): Prisma.QuestionWhereInput {
    const contains = { contains: q, mode: "insensitive" as const };
    return lang === "ru" ? { OR: [{ textRu: contains }, { text: contains }] } : { text: contains };
  }
}
