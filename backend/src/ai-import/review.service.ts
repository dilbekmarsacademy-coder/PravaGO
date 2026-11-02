import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type ImportImage, type ImportQuestion } from "@prisma/client";
import { randomBytes } from "crypto";
import sharp from "sharp";
import type { AdminUser } from "../admin/admin-request";
import { AuditService } from "../admin/audit.service";
import { QuestionEditorService, normalizeQuestionInput } from "../admin/content/question-editor.service";
import type { QuestionInputDto } from "../admin/content/question-input.dto";
import { latinToCyrillic } from "../common/translit";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { makeMaster, makeVariants, sha256, toRgb, type Box } from "./image-ops";
import { ImportService, WATERMARK_SAMPLE_KEY, needsReview } from "./import.service";
import { findPhraseRange } from "./normalize";
import type { QDraft, Texts } from "./types";

// Admin tekshiruvi: savol kartochkalari, tahrirlash, rasm variantlari, tasdiqlash va
// "Yangi testlar"ga yozish (qo'lda qo'shilgan testlar bilan bir xil format).

export interface QuestionPatch {
  text?: Texts;
  options?: Texts[];
  correctIndex?: number | null;
  keywords?: { question: string | null; answer: string | null };
  explanation?: Texts | null;
  testId?: string;
  order?: number;
  deleted?: boolean;
  /** Ziddiyat hal qilindi (admin to'g'ri variantni tanladi). */
  resolveConflict?: boolean;
}

function isSafeToBulkApprove(d: QDraft, matchStatus: string, conflict: boolean, image: ImportImage | null): boolean {
  return (
    d.correctIndex !== null &&
    d.correctSource === "file" &&
    !d.aiDoubt &&
    !conflict &&
    (matchStatus === "same_file" || matchStatus === "matched") &&
    d.confidence !== "low" &&
    !(image && (image.needsReview || image.status === "error"))
  );
}

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly editor: QuestionEditorService,
    private readonly imports: ImportService,
  ) {}

  private async question(id: string): Promise<ImportQuestion> {
    const q = await this.prisma.importQuestion.findUnique({ where: { id } });
    if (!q) throw new NotFoundException("Savol topilmadi");
    return q;
  }

  private async assertDraft(testId: string | null) {
    if (!testId) return;
    const test = await this.prisma.importTest.findUnique({ where: { id: testId } });
    if (test?.status === "approved") throw new BadRequestException("Test allaqachon tasdiqlangan — endi \"Yangi testlar\"da tahrirlanadi");
  }

  /** Test savollari kartochkalari uchun. `filter=review` — faqat "tekshirish kerak". */
  async testQuestions(batchId: string, testId: string, filter: "all" | "review") {
    const test = await this.prisma.importTest.findFirst({ where: { id: testId, batchId } });
    if (!test) throw new NotFoundException("Test topilmadi");
    const rows = await this.prisma.importQuestion.findMany({ where: { batchId, testId, deleted: false }, orderBy: { order: "asc" } });
    const images = await this.prisma.importImage.findMany({ where: { id: { in: rows.map((r) => r.imageId).filter((x): x is string => Boolean(x)) } } });
    const imgById = new Map(images.map((i) => [i.id, i]));
    const items = rows.map((r) => {
      const d = r.data as unknown as QDraft;
      const img = r.imageId ? imgById.get(r.imageId) ?? null : null;
      const review = needsReview(d, r.matchStatus, r.conflict !== null);
      const imageProblem = Boolean(img && (img.needsReview || img.status === "error"));
      return {
        id: r.id,
        order: r.order,
        number: r.number,
        data: d,
        matchStatus: r.matchStatus,
        conflict: r.conflict,
        approved: r.approved,
        review,
        imageProblem,
        bulkApprovable: isSafeToBulkApprove(d, r.matchStatus, r.conflict !== null, img),
        image: img
          ? { id: img.id, status: img.status, needsReview: img.needsReview, selected: img.selected, hasCleaned: Boolean(img.cleanedKey), hasCrop: Boolean(img.cropKey), boxes: img.boxes, width: img.width, height: img.height, note: img.error }
          : null,
      };
    });
    return { test, items: filter === "review" ? items.filter((i) => i.review || i.imageProblem) : items };
  }

  async updateQuestion(admin: AdminUser, ip: string, id: string, patch: QuestionPatch) {
    const q = await this.question(id);
    await this.assertDraft(q.testId);
    const d = q.data as unknown as QDraft;
    if (patch.text) d.text = patch.text;
    if (patch.options) {
      if (patch.options.length < 2 || patch.options.length > 6) throw new BadRequestException("Variantlar 2 tadan 6 tagacha");
      d.options = patch.options;
      if (d.correctIndex !== null && d.correctIndex >= d.options.length) d.correctIndex = null;
    }
    if (patch.correctIndex !== undefined) {
      if (patch.correctIndex !== null && (patch.correctIndex < 0 || patch.correctIndex >= d.options.length)) throw new BadRequestException("To'g'ri javob variantlar orasida bo'lishi kerak");
      if (patch.correctIndex !== d.correctIndex) {
        d.correctIndex = patch.correctIndex;
        // Admin tanladi — manba "fayl" emas, lekin admin tasdig'i bilan.
        d.correctSource = d.correctSource ?? "ai";
        d.aiDoubt = null;
      }
    }
    if (patch.keywords) d.keywords = { question: patch.keywords.question?.trim() || null, answer: patch.keywords.answer?.trim() || null, source: d.keywords.source ?? "file" };
    if (patch.explanation !== undefined) {
      d.explanation = patch.explanation;
      d.explanationSource = patch.explanation ? (d.explanationSource ?? "ai") : null;
    }
    d.edited = true;
    let testId = q.testId;
    if (patch.testId && patch.testId !== q.testId) {
      const target = await this.prisma.importTest.findFirst({ where: { id: patch.testId, batchId: q.batchId } });
      if (!target) throw new NotFoundException("Test topilmadi");
      await this.assertDraft(target.id);
      testId = target.id;
    }
    let order = patch.order ?? q.order;
    if (testId !== q.testId && patch.order === undefined) {
      const last = await this.prisma.importQuestion.aggregate({ where: { testId }, _max: { order: true } });
      order = (last._max.order ?? 0) + 1;
    }
    const conflict = patch.resolveConflict ? Prisma.DbNull : undefined;
    const updated = await this.prisma.importQuestion.update({
      where: { id },
      data: { data: d as unknown as Prisma.InputJsonValue, testId, order, approved: false, ...(patch.deleted !== undefined ? { deleted: patch.deleted } : {}), ...(conflict ? { conflict } : {}) },
    });
    await this.audit.log(admin, ip, { action: "ai_import.question_edited", entityType: "ai_import_question", entityId: id, after: { fields: Object.keys(patch) } });
    return updated;
  }

  /** Savollar tartibi (test ichida). */
  async reorder(testId: string, ids: string[]) {
    await this.assertDraft(testId);
    await this.prisma.$transaction(ids.map((id, i) => this.prisma.importQuestion.updateMany({ where: { id, testId }, data: { order: i + 1 } })));
  }

  async approveQuestion(admin: AdminUser, ip: string, id: string, approved: boolean) {
    const q = await this.question(id);
    await this.assertDraft(q.testId);
    const d = q.data as unknown as QDraft;
    if (approved && d.correctIndex === null) throw new BadRequestException("Avval to'g'ri javobni belgilang");
    if (approved && q.conflict) throw new BadRequestException("Ziddiyat hal qilinmagan — to'g'ri variantni tanlang");
    await this.prisma.importQuestion.update({ where: { id }, data: { approved } });
    await this.audit.log(admin, ip, { action: approved ? "ai_import.question_approved" : "ai_import.question_unapproved", entityType: "ai_import_question", entityId: id });
  }

  /** "Fayldagi javoblarni tasdiqlash": fayldan kelgan va shubhasiz javoblar bir bosishda. */
  async approveFileAnswers(admin: AdminUser, ip: string, testId: string) {
    await this.assertDraft(testId);
    const rows = await this.prisma.importQuestion.findMany({ where: { testId, deleted: false, approved: false } });
    const images = await this.prisma.importImage.findMany({ where: { id: { in: rows.map((r) => r.imageId).filter((x): x is string => Boolean(x)) } } });
    const imgById = new Map(images.map((i) => [i.id, i]));
    const ids = rows.filter((r) => isSafeToBulkApprove(r.data as unknown as QDraft, r.matchStatus, r.conflict !== null, r.imageId ? imgById.get(r.imageId) ?? null : null)).map((r) => r.id);
    if (ids.length) await this.prisma.importQuestion.updateMany({ where: { id: { in: ids } }, data: { approved: true } });
    await this.audit.log(admin, ip, { action: "ai_import.file_answers_approved", entityType: "ai_import_test", entityId: testId, after: { count: ids.length } });
    return { approved: ids.length, remaining: rows.length - ids.length };
  }

  async updateTest(admin: AdminUser, ip: string, batchId: string, testId: string, patch: { title?: string; linkedTopicSlug?: string | null; groupId?: string; day?: number | null; topicNumber?: number | null }) {
    const test = await this.prisma.importTest.findFirst({ where: { id: testId, batchId } });
    if (!test) throw new NotFoundException("Test topilmadi");
    await this.assertDraft(testId);
    if (patch.linkedTopicSlug) {
      const topic = await this.prisma.topic.findFirst({ where: { slug: patch.linkedTopicSlug, kind: "course", deletedAt: null } });
      if (!topic) throw new BadRequestException("Bunday kurs mavzusi yo'q — mavzu avtomatik yaratilmaydi");
    }
    if (patch.groupId) {
      const group = await this.prisma.testGroup.findFirst({ where: { id: patch.groupId, deletedAt: null } });
      if (!group) throw new NotFoundException("To'plam topilmadi");
    }
    const after = await this.prisma.importTest.update({
      where: { id: testId },
      data: {
        ...(patch.title !== undefined ? { title: patch.title.trim().slice(0, 300) || test.title } : {}),
        ...(patch.linkedTopicSlug !== undefined ? { linkedTopicSlug: patch.linkedTopicSlug } : {}),
        ...(patch.groupId ? { groupId: patch.groupId } : {}),
        ...(patch.day !== undefined ? { day: patch.day } : {}),
        ...(patch.topicNumber !== undefined ? { topicNumber: patch.topicNumber } : {}),
      },
    });
    await this.audit.log(admin, ip, { action: "ai_import.test_edited", entityType: "ai_import_test", entityId: testId, before: test, after });
    return after;
  }

  // ───────── Rasmlar ─────────

  private async image(id: string): Promise<ImportImage> {
    const img = await this.prisma.importImage.findUnique({ where: { id } });
    if (!img) throw new NotFoundException("Rasm topilmadi");
    return img;
  }

  async imageFile(id: string, variant: "original" | "cleaned" | "crop"): Promise<{ data: Buffer; mime: string }> {
    const img = await this.image(id);
    const key = variant === "cleaned" ? img.cleanedKey : variant === "crop" ? img.cropKey : img.originalKey;
    if (!key) throw new NotFoundException("Bu variant yo'q");
    const data = await this.storage.get(key);
    const meta = await sharp(data).metadata();
    return { data, mime: `image/${meta.format === "jpeg" ? "jpeg" : meta.format ?? "png"}` };
  }

  async selectImage(id: string, selected: "original" | "cleaned" | "crop") {
    const img = await this.image(id);
    if (selected === "cleaned" && !img.cleanedKey) throw new BadRequestException("Tozalangan variant yo'q");
    if (selected === "crop" && !img.cropKey) throw new BadRequestException("Crop variant yo'q");
    await this.prisma.importImage.update({ where: { id }, data: { selected, ...(selected === "original" ? {} : {}) } });
    await this.prisma.importQuestion.updateMany({ where: { imageId: id }, data: { approved: false } });
  }

  /** Qayta tozalash: admin chizgan to'rtburchaklar (0..1) yoki (bo'sh bo'lsa) AI bilan qaytadan. */
  async reclean(id: string, boxes: Box[] | null) {
    const img = await this.image(id);
    const batch = await this.imports.batchOrThrow(img.batchId);
    await this.imports.processImage({ ...batch, removeWatermarks: true }, img, boxes && boxes.length ? boxes : null);
    await this.prisma.importQuestion.updateMany({ where: { imageId: id }, data: { approved: false } });
    return this.image(id);
  }

  /** Savolga yangi rasm yuklash (asl rasm o'rniga). */
  async replaceImage(questionId: string, data: Buffer) {
    const q = await this.question(questionId);
    await this.assertDraft(q.testId);
    const meta = await sharp(data).metadata().catch(() => null);
    if (!meta?.width) throw new BadRequestException("Rasm o'qilmadi");
    const hash = sha256(data);
    const key = `imports/${q.batchId}/images/${hash}-upload.${meta.format ?? "png"}`;
    await this.storage.put(key, data, `image/${meta.format ?? "png"}`);
    const img =
      (await this.prisma.importImage.findUnique({ where: { batchId_sha256: { batchId: q.batchId, sha256: hash } } })) ??
      (await this.prisma.importImage.create({ data: { batchId: q.batchId, sha256: hash, originalKey: key, status: "done", selected: "original", width: meta.width, height: meta.height ?? null } }));
    await this.prisma.importQuestion.update({ where: { id: questionId }, data: { imageId: img.id, approved: false } });
    return img;
  }

  async removeImage(questionId: string) {
    const q = await this.question(questionId);
    await this.assertDraft(q.testId);
    await this.prisma.importQuestion.update({ where: { id: questionId }, data: { imageId: null, approved: false } });
  }

  // ───────── Tasdiqlash va "Yangi testlar"ga yozish ─────────

  /**
   * Test tasdiqlanadi: barcha savollar admin tasdiqlagan bo'lishi shart. Savollar
   * "Yangi testlar"ga (tanlangan to'plamga) oddiy test sifatida yoziladi: kalit so'z
   * belgilari, rasm (WebP 1600 + 800 srcset), tasdiqlangan izoh. Audit'ga yoziladi.
   */
  async publishTest(admin: AdminUser, ip: string, batchId: string, testId: string) {
    const test = await this.prisma.importTest.findFirst({ where: { id: testId, batchId } });
    if (!test) throw new NotFoundException("Test topilmadi");
    if (test.status === "approved") throw new BadRequestException("Test allaqachon tasdiqlangan");
    const batch = await this.imports.batchOrThrow(batchId);
    const groupId = test.groupId ?? batch.groupId;
    if (!groupId) throw new BadRequestException("To'plam tanlanmagan");
    const rows = await this.prisma.importQuestion.findMany({ where: { testId, deleted: false }, orderBy: { order: "asc" } });
    if (!rows.length) throw new BadRequestException("Testda savol yo'q");
    const notApproved = rows.filter((r) => !r.approved).length;
    if (notApproved) throw new BadRequestException({ statusCode: 400, code: "NOT_ALL_APPROVED", message: `${notApproved} ta savol hali tasdiqlanmagan`, notApproved });

    // Rasmlar: tanlangan variantdan master (storage) va WebP variantlar (MediaAsset) — tranzaksiyadan oldin.
    const assets = new Map<string, { large: string; small: string }>();
    for (const imageId of [...new Set(rows.map((r) => r.imageId).filter((x): x is string => Boolean(x)))]) {
      const img = await this.image(imageId);
      const key = img.selected === "cleaned" && img.cleanedKey ? img.cleanedKey : img.selected === "crop" && img.cropKey ? img.cropKey : img.originalKey;
      const master = await makeMaster(await toRgb(await this.storage.get(key), 4000));
      const masterKey = `imports/${batchId}/images/${img.id}-master.webp`;
      await this.storage.put(masterKey, master.data, "image/webp");
      await this.prisma.importImage.update({ where: { id: img.id }, data: { masterKey } });
      const [small, large] = await makeVariants(master.data);
      const create = async (v: typeof small) =>
        (
          await this.prisma.mediaAsset.create({
            data: { kind: "processed", mime: "image/webp", width: v.width, height: v.height, size: v.data.length, sha256: sha256(v.data), public: true, data: new Uint8Array(v.data), sourceId: null, createdById: admin.id },
          })
        ).id;
      assets.set(imageId, { large: await create(large), small: await create(small) });
    }

    const titleLatn = test.title;
    const topic = await this.prisma.$transaction(
      async (tx) => {
        const last = await tx.topic.aggregate({ where: { kind: "collection", groupId }, _max: { sortOrder: true } });
        const topic = await tx.topic.create({
          data: {
            slug: `new-${randomBytes(5).toString("hex")}`,
            kind: "collection",
            published: true,
            groupId,
            sortOrder: (last._max.sortOrder ?? 0) + 1,
            title: titleLatn,
            titleCyrl: latinToCyrillic(titleLatn),
            linkedDay: test.day,
            linkedTopicSlug: test.linkedTopicSlug,
          },
        });
        let order = 0;
        for (const r of rows) {
          const d = r.data as unknown as QDraft;
          const correct = d.options[d.correctIndex!];
          const ranges = (text: Texts, phrase: string | null) => {
            if (!phrase) return {};
            const out: Partial<Record<"uz" | "cyrl" | "ru", [number, number][]>> = {};
            const uz = findPhraseRange(text.latn, phrase);
            const cyrl = findPhraseRange(text.cyrl, phrase);
            if (uz) out.uz = [uz];
            if (cyrl) out.cyrl = [cyrl];
            return out;
          };
          const qRanges = ranges(d.text, d.keywords.question);
          const aRanges = ranges(correct, d.keywords.answer);
          const none = !Object.keys(qRanges).length && !Object.keys(aRanges).length;
          const asset = r.imageId ? assets.get(r.imageId) : undefined;
          const input = {
            text: d.text,
            options: d.options.map((o) => ({ text: o })),
            correctIndex: d.correctIndex!,
            explanation: d.explanation ?? { cyrl: "", latn: "", ru: "" },
            keywords: { none, question: qRanges, answer: aRanges },
            ruNeedsReview: d.ruNeedsReview,
            ...(asset ? { imageAssetId: asset.large } : {}),
          } as unknown as QuestionInputDto;
          const normalized = normalizeQuestionInput(input);
          const created = await tx.question.create({ data: { topicId: topic.id, order: ++order, text: d.text.cyrl, keyword: "", ruNeedsReview: d.ruNeedsReview } });
          await this.editor.write(tx, created.id, input, normalized, asset ? { imageSmallUrl: `/media/${asset.small}.webp` } : {});
          // Izoh admin tekshiruvidan o'tdi (savol tasdiqlangan) — o'quvchiga ko'rinadi.
          await tx.question.update({ where: { id: created.id }, data: { explanationApproved: Boolean(d.explanation && (d.explanation.latn || d.explanation.cyrl)) } });
        }
        await tx.importTest.update({ where: { id: testId }, data: { status: "approved", publishedTopicId: topic.id, approvedById: admin.id, approvedAt: new Date() } });
        return topic;
      },
      { timeout: 60_000 },
    );
    const remaining = await this.prisma.importTest.count({ where: { batchId, status: { not: "approved" } } });
    if (!remaining) await this.prisma.importBatch.update({ where: { id: batchId }, data: { status: "approved" } });
    await this.audit.log(admin, ip, {
      action: "ai_import.test_published",
      entityType: "collection",
      entityId: topic.id,
      after: {
        importTestId: testId,
        batchId,
        title: titleLatn,
        groupId,
        questions: rows.length,
        editedByAdmin: rows.filter((r) => (r.data as unknown as QDraft).edited).length,
        aiAnswers: rows.filter((r) => (r.data as unknown as QDraft).correctSource === "ai").length,
        images: assets.size,
      },
    });
    return { topicId: topic.id, slug: topic.slug };
  }

  // ───────── Sozlamalar: watermark namunasi ─────────

  async watermarkSample() {
    const row = await this.prisma.appSetting.findUnique({ where: { key: WATERMARK_SAMPLE_KEY } });
    return (row?.value as { storageKey?: string; position?: string; updatedAt?: string } | null) ?? null;
  }

  async setWatermarkSample(admin: AdminUser, ip: string, data: Buffer | null, position: string | null) {
    if (!data) {
      await this.prisma.appSetting.deleteMany({ where: { key: WATERMARK_SAMPLE_KEY } });
      await this.audit.log(admin, ip, { action: "ai_import.watermark_sample_removed", entityType: "setting", entityId: WATERMARK_SAMPLE_KEY });
      return null;
    }
    const meta = await sharp(data).metadata().catch(() => null);
    if (!meta?.width) throw new BadRequestException("Rasm o'qilmadi");
    const png = await sharp(data).png().toBuffer();
    const storageKey = `settings/watermark-sample-${sha256(png).slice(0, 16)}.png`;
    await this.storage.put(storageKey, png, "image/png");
    const value = { storageKey, position: position?.slice(0, 40) ?? null, updatedAt: new Date().toISOString() };
    await this.prisma.appSetting.upsert({ where: { key: WATERMARK_SAMPLE_KEY }, create: { key: WATERMARK_SAMPLE_KEY, value }, update: { value } });
    await this.audit.log(admin, ip, { action: "ai_import.watermark_sample_set", entityType: "setting", entityId: WATERMARK_SAMPLE_KEY, after: value });
    return value;
  }

  async watermarkSampleFile(): Promise<Buffer | null> {
    const v = await this.watermarkSample();
    return v?.storageKey ? this.storage.get(v.storageKey) : null;
  }
}
