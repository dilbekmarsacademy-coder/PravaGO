import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../admin/audit.service";
import type { AdminUser } from "../admin/admin-request";
import { QuestionEditorService, normalizeQuestionInput, toEditable } from "../admin/content/question-editor.service";
import type { QuestionInputDto } from "../admin/content/question-input.dto";
import { toLocalizedText } from "../common/localized-text";
import { PASS_PERCENT } from "../common/rules";
import type { CreateCollectionDto, UpdateCollectionDto } from "./collections.dto";
import { similarity } from "./similarity";

const COLLECTION = "collection";

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly editor: QuestionEditorService,
  ) {}

  private async find(id: string) {
    const topic = await this.prisma.topic.findFirst({ where: { id, kind: COLLECTION, deletedAt: null } });
    if (!topic) throw new NotFoundException("To'plam topilmadi");
    return topic;
  }

  // ── Admin ──

  async list() {
    const rows = await this.prisma.topic.findMany({
      where: { kind: COLLECTION, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { questions: { where: { deletedAt: null } } } } },
    });
    return rows.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: { uz: t.title, cyrl: t.titleCyrl ?? "", ru: t.titleRu ?? "" },
      published: t.published,
      sortOrder: t.sortOrder,
      questionCount: t._count.questions,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  async create(admin: AdminUser, ip: string, dto: CreateCollectionDto) {
    const last = await this.prisma.topic.aggregate({ where: { kind: COLLECTION }, _max: { sortOrder: true } });
    const topic = await this.prisma.topic.create({
      data: {
        slug: `new-${randomBytes(5).toString("hex")}`,
        kind: COLLECTION,
        published: false,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
        title: dto.title.uz.trim(),
        titleCyrl: dto.title.cyrl?.trim() || null,
        titleRu: dto.title.ru?.trim() || null,
      },
    });
    await this.audit.log(admin, ip, { action: "collection.created", entityType: "collection", entityId: topic.id, after: topic });
    return topic;
  }

  async update(admin: AdminUser, ip: string, id: string, dto: UpdateCollectionDto) {
    const before = await this.find(id);
    const after = await this.prisma.topic.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title.uz.trim(), titleCyrl: dto.title.cyrl?.trim() || null, titleRu: dto.title.ru?.trim() || null } : {}),
        ...(dto.published !== undefined ? { published: dto.published } : {}),
      },
    });
    if (dto.published && !before.published) {
      const count = await this.prisma.question.count({ where: { topicId: id, deletedAt: null } });
      if (count === 0) {
        await this.prisma.topic.update({ where: { id }, data: { published: false } });
        throw new BadRequestException("Savolsiz to'plamni nashr qilib bo'lmaydi");
      }
    }
    const action = dto.published === undefined ? "collection.updated" : dto.published ? "collection.published" : "collection.unpublished";
    await this.audit.log(admin, ip, { action, entityType: "collection", entityId: id, before, after });
    return after;
  }

  async reorder(admin: AdminUser, ip: string, ids: string[]) {
    await this.prisma.$transaction(ids.map((id, i) => this.prisma.topic.updateMany({ where: { id, kind: COLLECTION }, data: { sortOrder: i + 1 } })));
    await this.audit.log(admin, ip, { action: "collection.reordered", entityType: "collection", after: { ids } });
    return this.list();
  }

  async remove(admin: AdminUser, ip: string, id: string) {
    const before = await this.find(id);
    // Savollari ham o'chiriladi — foydalanuvchining "Saqlanganlar"idan ham yo'qoladi.
    const now = new Date();
    const [, questions] = await this.prisma.$transaction([
      this.prisma.topic.update({ where: { id }, data: { deletedAt: now, published: false } }),
      this.prisma.question.updateMany({ where: { topicId: id, deletedAt: null }, data: { deletedAt: now } }),
      this.prisma.savedQuestion.deleteMany({ where: { topicId: id } }),
    ]);
    await this.audit.log(admin, ip, { action: "collection.deleted", entityType: "collection", entityId: id, before, after: { deletedQuestions: questions.count } });
  }

  async questions(id: string) {
    const topic = await this.find(id);
    const rows = await this.prisma.question.findMany({
      where: { topicId: id, deletedAt: null },
      orderBy: { order: "asc" },
      include: { options: { orderBy: [{ order: "asc" }] }, keywords: true, topic: { select: { slug: true, kind: true } } },
    });
    return {
      collection: { id: topic.id, slug: topic.slug, title: { uz: topic.title, cyrl: topic.titleCyrl ?? "", ru: topic.titleRu ?? "" }, published: topic.published },
      items: rows.map(toEditable),
    };
  }

  async createQuestion(admin: AdminUser, ip: string, collectionId: string, input: QuestionInputDto) {
    await this.find(collectionId);
    const data = normalizeQuestionInput(input);
    const id = await this.prisma.$transaction(async (tx) => {
      const last = await tx.question.aggregate({ where: { topicId: collectionId }, _max: { order: true } });
      const q = await tx.question.create({
        data: { topicId: collectionId, order: (last._max.order ?? 0) + 1, text: data.text.cyrl, keyword: "", ruNeedsReview: input.ruNeedsReview ?? true },
      });
      await this.editor.write(tx, q.id, input, data);
      return q.id;
    });
    const after = await this.editor.get(id);
    await this.audit.log(admin, ip, { action: "question.created", entityType: "question", entityId: id, after });
    return after;
  }

  /** Yumshoq o'chirish — faqat "Yangi testlar" savollari. Foydalanuvchilarning saqlanganlaridan ham olinadi. */
  async deleteQuestion(admin: AdminUser, ip: string, questionId: string) {
    const q = await this.editor.load(questionId);
    if (q.deletedAt) throw new NotFoundException("Savol topilmadi");
    if (q.topic.kind !== COLLECTION) throw new BadRequestException("Faqat \"Yangi testlar\" savollarini o'chirish mumkin");
    await this.prisma.$transaction([
      this.prisma.question.update({ where: { id: questionId }, data: { deletedAt: new Date() } }),
      this.prisma.savedQuestion.deleteMany({ where: { questionId } }),
    ]);
    await this.audit.log(admin, ip, { action: "question.deleted", entityType: "question", entityId: questionId, before: toEditable(q) });
  }

  /** O'xshash savollar (butun baza bo'yicha) — dublikat ogohlantiruvi. */
  async similar(text: string, excludeId?: string) {
    if (text.trim().length < 12) return [];
    const rows = await this.prisma.question.findMany({
      where: { deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true, text: true, textLatn: true, order: true, topic: { select: { slug: true, title: true, kind: true } } },
    });
    return rows
      .map((q) => ({ ...q, score: similarity(text, q.textLatn ?? q.text) }))
      .filter((q) => q.score >= 0.72)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((q) => ({ id: q.id, text: q.textLatn ?? q.text, topicSlug: q.topic.slug, topicTitle: q.topic.title, order: q.order, score: Math.round(q.score * 100) }));
  }

  // ── Sayt ──

  /** Nashr qilingan to'plamlar (to'lov qilganlar uchun) — foydalanuvchining eng yaxshi natijasi bilan. */
  async published(userId: string) {
    const rows = await this.prisma.topic.findMany({
      where: { kind: COLLECTION, published: true, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { questions: { where: { deletedAt: null } } } },
        testAttempts: { where: { userId }, select: { percent: true } },
      },
    });
    return rows
      .filter((t) => t._count.questions > 0)
      .map((t) => {
        const best = t.testAttempts.length ? Math.max(...t.testAttempts.map((a) => a.percent)) : null;
        return {
          slug: t.slug,
          title: { ...toLocalizedText(t.titleCyrl ?? t.title, t.titleRu, t.title) },
          questionCount: t._count.questions,
          attempts: t.testAttempts.length,
          bestPercent: best,
          passed: best !== null && best >= PASS_PERCENT,
        };
      });
  }
}
