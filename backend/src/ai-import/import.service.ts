import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma, type ImportBatch, type ImportFile, type ImportImage } from "@prisma/client";
import { AiService, type UsageMeta } from "../ai/ai.service";
import type { AdminUser } from "../admin/admin-request";
import { AuditService } from "../admin/audit.service";
import { cyrillicToLatin, latinToCyrillic } from "../common/translit";
import { parseCourseSlug } from "../common/rules";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { MAX_IMPORT_FILE_BYTES } from "../storage/storage";
import { analyzeQuestions, classifyFile, confirmMatches, detectWatermarkBoxes, estimateCostUsd, verifyCleaned, type AnalyzeInput } from "./ai-steps";
import { aiJpeg, cropRgb, edgeCrop, inpaintBest, rgbToPng, sha256, templateMatch, toRgb, type Box } from "./image-ops";
import { applyEntry, findDuplicates, findExisting, matchQuestion, prepareSite, type KeySource, type MatchResult, type RawQuestion } from "./matching";
import { detectScript, findPhraseRange, textSimilarity } from "./normalize";
import { extractFile, fileType, SUPPORTED_EXTENSIONS, unzip } from "./parse";
import type { BatchStats, ExtractedJson, FileClassification, QDraft, Texts } from "./types";

// AI bilan fayllardan import — bosqichma-bosqich, qayta tiklanadigan va idempotent jarayon.
// Holat Postgres'da; admin sahifasi `step` ni qayta-qayta chaqiradi, har bir qadam bitta
// so'rovda ≤ 40 s: fayl ochish → tasnif → guruhlash va moslashtirish → shubhali juftliklar →
// savollar tahlili (4–6 tadan) → rasmlar (3 tadan). Bitta faylda xato bo'lsa qolganlari davom etadi.

const STEP_BUDGET_MS = 30_000;
const LOCK_MS = 55_000;
const ANALYZE_BATCH = 6;
const ANALYZE_BATCH_WITH_IMAGES = 4;
const MATCH_BATCH = 8;
const IMAGE_BATCH = 3;
const MAX_ATTEMPTS = 2;

export const WATERMARK_SAMPLE_KEY = "import.watermark_sample";

export type Stage = "extract" | "ready" | "classify" | "group" | "match" | "analyze" | "images" | "done";

function emptyTexts(): Texts {
  return { cyrl: "", latn: "", ru: "" };
}

/** Asl yozuvdan ikkala o'zbek yozuviga (deterministik transliteratsiya). */
export function bothScripts(text: string): { cyrl: string; latn: string; script: "cyrl" | "latn" } {
  const script = detectScript(text) === "cyrl" ? "cyrl" : "latn";
  return script === "cyrl" ? { cyrl: text, latn: cyrillicToLatin(text), script } : { cyrl: latinToCyrillic(text), latn: text, script };
}

function zipAssetKey(batchId: string, parentId: string, path: string): string {
  return `imports/${batchId}/zip/${parentId}/${path.replace(/[^A-Za-z0-9._/-]/g, "_").replace(/\.\.+/g, "_")}`;
}

function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120) || "file";
}

function ext(name: string): string {
  return (name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "").slice(0, 8);
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  // ───────── Yaratish va yuklash ─────────

  /** Yangi import: to'plam (mavjud yoki yangi nom), fayllar ro'yxati — yuklash manzillari qaytadi. */
  async create(
    admin: AdminUser,
    ip: string,
    input: { groupId?: string; newGroupName?: string; removeWatermarks: boolean; hintDay?: number; hintTopicSlug?: string; files: { name: string; size: number; type?: string }[] },
  ) {
    if (!input.files.length) throw new BadRequestException("Kamida bitta fayl tanlang");
    const limit = this.storage.maxUploadBytes;
    for (const f of input.files) {
      if (!SUPPORTED_EXTENSIONS.includes(ext(f.name))) throw new BadRequestException(`"${f.name}": faqat ${SUPPORTED_EXTENSIONS.join(", ")} fayllar`);
      if (f.size > MAX_IMPORT_FILE_BYTES) throw new BadRequestException(`"${f.name}": fayl 50 MB dan katta`);
      if (f.size > limit) {
        throw new BadRequestException({
          statusCode: 400,
          code: "FILE_TOO_LARGE_FOR_STORAGE",
          message: `"${f.name}" (${(f.size / 1024 / 1024).toFixed(1)} MB): hozir har bir fayl ${(limit / 1024 / 1024).toFixed(0)} MB gacha. Katta fayllar (50 MB gacha) uchun Cloudflare R2 storage sozlanishi kerak (STORAGE_DRIVER=s3). Word'da rasmlarni siqing (rasmni tanlang → Picture Format → Compress Pictures → 150 ppi, «faqat shu rasmga» belgisini olib tashlang) yoki faylni bir necha qismga bo'lib yuklang.`,
        });
      }
    }
    let groupId = input.groupId ?? null;
    if (!groupId && input.newGroupName?.trim()) {
      const last = await this.prisma.testGroup.aggregate({ where: { deletedAt: null }, _max: { sortOrder: true } });
      const group = await this.prisma.testGroup.create({ data: { name: input.newGroupName.trim().slice(0, 200), sortOrder: (last._max.sortOrder ?? 0) + 1, createdById: admin.id } });
      await this.audit.log(admin, ip, { action: "test_group.created", entityType: "test_group", entityId: group.id, after: group });
      groupId = group.id;
    }
    if (!groupId) throw new BadRequestException("To'plamni tanlang yoki yangi to'plam nomini yozing");
    const group = await this.prisma.testGroup.findFirst({ where: { id: groupId, deletedAt: null } });
    if (!group) throw new NotFoundException("To'plam topilmadi");
    if (input.hintTopicSlug && !parseCourseSlug(input.hintTopicSlug)) throw new BadRequestException("Mavzu noto'g'ri");
    const hint = input.hintTopicSlug ? parseCourseSlug(input.hintTopicSlug) : null;

    const batch = await this.prisma.importBatch.create({
      data: {
        groupId,
        removeWatermarks: input.removeWatermarks,
        hintDay: input.hintDay ?? hint?.day ?? null,
        hintTopicSlug: input.hintTopicSlug ?? null,
        createdById: admin.id,
        status: "uploading",
        stage: "extract",
      },
    });
    const uploads: { fileId: string; name: string; target: Awaited<ReturnType<StorageService["uploadTarget"]>> }[] = [];
    for (const f of input.files) {
      const file = await this.prisma.importFile.create({ data: { batchId: batch.id, name: f.name.slice(0, 300), size: f.size, mime: f.type?.slice(0, 120) ?? null, status: "waiting" } });
      const key = `imports/${batch.id}/files/${file.id}/${safeName(f.name)}`;
      await this.prisma.importFile.update({ where: { id: file.id }, data: { storageKey: key } });
      uploads.push({ fileId: file.id, name: f.name, target: await this.storage.uploadTarget(key, f.type || "application/octet-stream") });
    }
    await this.audit.log(admin, ip, { action: "ai_import.created", entityType: "ai_import", entityId: batch.id, after: { files: input.files.map((f) => ({ name: f.name, size: f.size })), groupId, removeWatermarks: input.removeWatermarks } });
    return { batchId: batch.id, uploads, driver: this.storage.driverName };
  }

  private async fileOrThrow(batchId: string, fileId: string): Promise<ImportFile> {
    const file = await this.prisma.importFile.findFirst({ where: { id: fileId, batchId } });
    if (!file) throw new NotFoundException("Fayl topilmadi");
    return file;
  }

  /** Backend orqali yuklash (dev / db drayveri). */
  async upload(batchId: string, fileId: string, data: Buffer): Promise<void> {
    const file = await this.fileOrThrow(batchId, fileId);
    if (file.status !== "waiting" && file.status !== "error") throw new BadRequestException("Fayl allaqachon yuklangan");
    if (data.length > this.storage.maxUploadBytes) throw new BadRequestException("Fayl juda katta");
    await this.storage.put(file.storageKey!, data, file.mime ?? "application/octet-stream");
    await this.prisma.importFile.update({ where: { id: file.id }, data: { status: "uploaded", size: data.length, sha256: sha256(data), error: null } });
  }

  /** Brauzer presigned PUT bilan storage'ga yukladi (s3). */
  async markUploaded(batchId: string, fileId: string): Promise<void> {
    const file = await this.fileOrThrow(batchId, fileId);
    if (file.status !== "waiting") return;
    await this.prisma.importFile.update({ where: { id: file.id }, data: { status: "uploaded" } });
  }

  /** Boshlashdan oldin faylni olib tashlash. */
  async removeFile(batchId: string, fileId: string): Promise<void> {
    const batch = await this.batchOrThrow(batchId);
    if (!["uploading", "ready"].includes(batch.status)) throw new BadRequestException("Jarayon boshlangan — faylni olib tashlab bo'lmaydi");
    const file = await this.fileOrThrow(batchId, fileId);
    const children = await this.prisma.importFile.findMany({ where: { batchId, parentId: file.id }, select: { id: true } });
    await this.prisma.importFile.deleteMany({ where: { id: { in: [file.id, ...children.map((c) => c.id)] } } });
    if (file.storageKey) await this.storage.delete(file.storageKey).catch(() => undefined);
    await this.refreshStats(batchId);
  }

  async batchOrThrow(batchId: string): Promise<ImportBatch> {
    const batch = await this.prisma.importBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException("Import topilmadi");
    return batch;
  }

  /** "Boshlash": AI bosqichlari (budjet tekshiriladi). */
  async start(admin: AdminUser, ip: string, batchId: string) {
    const batch = await this.batchOrThrow(batchId);
    if (batch.status !== "ready") throw new BadRequestException(batch.status === "uploading" ? "Fayllar hali ochilmoqda" : "Import allaqachon boshlangan");
    if (this.ai.configured()) await this.ai.assertBudget();
    await this.prisma.importBatch.update({ where: { id: batchId }, data: { status: "processing", stage: "classify", error: null } });
    await this.audit.log(admin, ip, { action: "ai_import.started", entityType: "ai_import", entityId: batchId, after: { estimate: (batch.stats as BatchStats).estimate } });
    return this.detail(batchId);
  }

  // ───────── Qadamlar ─────────

  /**
   * Keyingi qadam. Bir vaqtda faqat bitta (qulf). Qaytadi: holat va progress —
   * admin sahifasi `done !== true` bo'lsa yana chaqiradi.
   */
  async step(batchId: string): Promise<{ busy?: boolean; status: string; stage: string; stats: BatchStats; continue: boolean }> {
    const now = new Date();
    const locked = await this.prisma.importBatch.updateMany({
      where: { id: batchId, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
      data: { lockedUntil: new Date(now.getTime() + LOCK_MS) },
    });
    const batch = await this.batchOrThrow(batchId);
    if (!locked.count) return { busy: true, status: batch.status, stage: batch.stage, stats: batch.stats as BatchStats, continue: true };
    const started = Date.now();
    try {
      await this.runStage(batch, started);
    } catch (err) {
      this.logger.warn(`Import ${batchId} qadami xatosi: ${err instanceof Error ? err.message : String(err)}`);
      const message = err instanceof Error ? err.message : String(err);
      const code = (err as { response?: { code?: string } }).response?.code;
      // Budjet yoki billing — jarayon to'xtaydi (admin xabarni ko'radi), boshqasi — keyingi qadamda qayta urinish.
      if (code === "AI_BUDGET_EXCEEDED" || code === "AI_BILLING" || code === "AI_AUTH") {
        await this.prisma.importBatch.update({ where: { id: batchId }, data: { status: "paused", error: message.slice(0, 1000) } });
      } else {
        await this.prisma.importBatch.update({ where: { id: batchId }, data: { error: message.slice(0, 1000) } });
      }
    } finally {
      await this.prisma.importBatch.update({ where: { id: batchId }, data: { lockedUntil: null } });
    }
    const stats = await this.refreshStats(batchId);
    const after = await this.batchOrThrow(batchId);
    return { status: after.status, stage: after.stage, stats, continue: after.status === "uploading" || after.status === "processing" };
  }

  /** Budjet/billing sababli to'xtagan importni davom ettirish. */
  async resume(batchId: string) {
    const batch = await this.batchOrThrow(batchId);
    if (batch.status !== "paused") return this.detail(batchId);
    if (this.ai.configured()) await this.ai.assertBudget();
    await this.prisma.importBatch.update({ where: { id: batchId }, data: { status: "processing", error: null } });
    return this.detail(batchId);
  }

  private meta(batch: ImportBatch): UsageMeta {
    return { batchId: batch.id, adminId: batch.createdById };
  }

  private async setStage(batchId: string, stage: Stage, extra: Prisma.ImportBatchUpdateInput = {}) {
    await this.prisma.importBatch.update({ where: { id: batchId }, data: { stage, ...extra } });
  }

  private async runStage(batch: ImportBatch, started: number): Promise<void> {
    const timeLeft = () => STEP_BUDGET_MS - (Date.now() - started);
    switch (batch.stage as Stage) {
      case "extract":
        return this.stageExtract(batch);
      case "classify":
        return this.stageClassify(batch);
      case "group":
        await this.buildDrafts(batch);
        return this.setStage(batch.id, "match");
      case "match":
        return this.stageMatch(batch);
      case "analyze":
        return this.stageAnalyze(batch);
      case "images": {
        // Vaqt yetguncha 3 tadan.
        let more = true;
        while (more && timeLeft() > 12_000) more = await this.stageImages(batch);
        return;
      }
      default:
        return;
    }
  }

  // 1. Fayllarni ochish (AI'siz)
  private async stageExtract(batch: ImportBatch): Promise<void> {
    const file = await this.prisma.importFile.findFirst({ where: { batchId: batch.id, status: "uploaded" }, orderBy: { createdAt: "asc" } });
    if (!file) {
      const waiting = await this.prisma.importFile.count({ where: { batchId: batch.id, status: "waiting" } });
      if (waiting > 0) return; // hali yuklanmoqda
      const ok = await this.prisma.importFile.count({ where: { batchId: batch.id, status: "extracted" } });
      const estimate = await this.estimate(batch.id, batch.removeWatermarks);
      await this.setStage(batch.id, "ready", { status: ok > 0 ? "ready" : "failed", error: ok > 0 ? null : "Hech bir fayldan ma'lumot olinmadi" });
      await this.mergeStats(batch.id, { estimate });
      return;
    }
    try {
      const data = await this.storage.get(file.storageKey!);
      if (fileType(file.name) === "zip") {
        const { files, assets } = await unzip(data);
        for (const [path, buf] of assets) await this.storage.put(zipAssetKey(batch.id, file.id, path), buf, "application/octet-stream");
        for (const inner of files) {
          const child = await this.prisma.importFile.create({ data: { batchId: batch.id, parentId: file.id, name: inner.name.slice(0, 300), size: inner.data.length, sha256: sha256(inner.data), status: "uploaded" } });
          const key = `imports/${batch.id}/files/${child.id}/${safeName(inner.name)}`;
          await this.storage.put(key, inner.data, "application/octet-stream");
          await this.prisma.importFile.update({ where: { id: child.id }, data: { storageKey: key } });
        }
        await this.prisma.importFile.update({
          where: { id: file.id },
          data: { status: "archive", kind: "archive", skipReason: `${files.length} ta fayl ochildi`, extracted: { assets: [...assets.keys()] } as Prisma.InputJsonValue },
        });
        return;
      }
      const hint = batch.hintTopicSlug ? parseCourseSlug(batch.hintTopicSlug) : null;
      const result = await extractFile(file.name, data, {
        day: hint?.day ?? batch.hintDay ?? undefined,
        topicNumber: hint?.order,
        assets: file.parentId ? await this.zipAssets(batch.id, file.parentId) : undefined,
      });
      const images: Record<string, string> = {};
      const refs = new Set(result.structure.questions.flatMap((q) => q.imageRefs));
      for (const ref of refs) {
        const raw = await result.read.readImage(ref);
        if (!raw || raw.data.length < 200) continue;
        const hash = sha256(raw.data);
        const existing = await this.prisma.importImage.findUnique({ where: { batchId_sha256: { batchId: batch.id, sha256: hash } } });
        if (existing) {
          images[ref] = existing.id;
          continue;
        }
        const key = `imports/${batch.id}/images/${hash}${raw.ext ? `.${raw.ext}` : ""}`;
        await this.storage.put(key, raw.data, `image/${raw.ext === "jpg" ? "jpeg" : raw.ext || "png"}`);
        const created = await this.prisma.importImage.create({ data: { batchId: batch.id, sha256: hash, sourceFileId: file.id, originalKey: key, status: "pending" } });
        images[ref] = created.id;
      }
      const extracted: ExtractedJson = { structure: result.structure, preview: result.preview, script: result.script, title: result.title, images };
      await this.prisma.importFile.update({
        where: { id: file.id },
        data: { status: "extracted", extracted: extracted as unknown as Prisma.InputJsonValue, error: null, attempts: { increment: 1 } },
      });
    } catch (err) {
      await this.prisma.importFile.update({ where: { id: file.id }, data: { status: "error", error: (err instanceof Error ? err.message : String(err)).slice(0, 1000), attempts: { increment: 1 } } });
    }
  }

  /** Zip ichidagi HTML havola qiladigan rasmlar (zip ochilganda storage'ga yozilgan). */
  private async zipAssets(batchId: string, parentId: string): Promise<Map<string, Buffer>> {
    const parent = await this.prisma.importFile.findUnique({ where: { id: parentId }, select: { extracted: true } });
    const paths = ((parent?.extracted as { assets?: string[] } | null)?.assets ?? []).slice(0, 300);
    const out = new Map<string, Buffer>();
    for (const path of paths) {
      const data = await this.storage.get(zipAssetKey(batchId, parentId, path)).catch(() => null);
      if (data) out.set(path, data);
    }
    return out;
  }

  /** Boshlashdan oldingi taxminiy narx (fayllar ochilgach — aniq sonlar bilan). */
  async estimate(batchId: string, watermarks: boolean): Promise<BatchStats["estimate"]> {
    const files = await this.prisma.importFile.findMany({ where: { batchId, status: "extracted" }, select: { extracted: true } });
    let questions = 0;
    let withImage = 0;
    for (const f of files) {
      const ex = f.extracted as unknown as ExtractedJson | null;
      for (const q of ex?.structure.questions ?? []) {
        questions++;
        if (q.imageRefs.length) withImage++;
      }
    }
    const images = await this.prisma.importImage.count({ where: { batchId } });
    return { usd: estimateCostUsd({ files: files.length, questions, questionsWithImage: withImage, images, watermarks }), questions, images, files: files.length };
  }

  // 2. Fayl turini aniqlash
  private async stageClassify(batch: ImportBatch): Promise<void> {
    const file = await this.prisma.importFile.findFirst({ where: { batchId: batch.id, status: "extracted" }, orderBy: { createdAt: "asc" } });
    if (!file) return this.setStage(batch.id, "group");
    const ex = file.extracted as unknown as ExtractedJson;
    const s = ex.structure;
    const summary = {
      questions: s.questions.length,
      withAnswer: s.questions.filter((q) => q.correctIndex !== null).length,
      withImage: s.questions.filter((q) => q.imageRefs.length).length,
      answerKeys: s.answerKeys.length,
      keywordEntries: s.keywords.length,
      headings: s.headings.map((h) => h.raw).slice(0, 10),
    };
    let cls: FileClassification = rulesClassification(s, ex.script);
    if (this.ai.configured()) {
      try {
        cls = await classifyFile(this.ai, { name: file.name, summary, preview: ex.preview }, this.meta(batch));
        // AI "aloqasi yo'q" desa-yu, parser savol topgan bo'lsa — parserga ishonamiz.
        if (cls.kind === "unrelated" && (summary.questions > 0 || summary.answerKeys > 0 || summary.keywordEntries > 0)) cls = { ...rulesClassification(s, ex.script), reason: `AI: ${cls.reason ?? "aloqasi yo'q"} — lekin savollar topildi` };
      } catch (err) {
        const code = (err as { response?: { code?: string } }).response?.code;
        if (code === "AI_BUDGET_EXCEEDED" || code === "AI_BILLING" || code === "AI_AUTH") throw err;
        cls = { ...cls, reason: `AI tasnifi bajarilmadi — qoidalar bo'yicha (${err instanceof Error ? err.message.slice(0, 120) : "xato"})` };
      }
    }
    const skipped = cls.kind === "unrelated";
    await this.prisma.importFile.update({
      where: { id: file.id },
      data: {
        status: skipped ? "skipped" : "classified",
        kind: cls.kind,
        classification: cls as unknown as Prisma.InputJsonValue,
        skipReason: skipped ? (cls.reason ?? "Testga aloqasi yo'q") : null,
      },
    });
  }

  // 3. Guruhlash, moslashtirish, dublikat va mavjudlar (AI'siz)
  async buildDrafts(batch: ImportBatch): Promise<void> {
    // Idempotent: oldingi urinish qoldiqlari o'chiriladi.
    await this.prisma.importQuestion.deleteMany({ where: { batchId: batch.id } });
    await this.prisma.importTest.deleteMany({ where: { batchId: batch.id } });
    const files = await this.prisma.importFile.findMany({ where: { batchId: batch.id, status: "classified" }, orderBy: { createdAt: "asc" } });
    const hint = batch.hintTopicSlug ? parseCourseSlug(batch.hintTopicSlug) : null;

    const raws: RawQuestion[] = [];
    const sources: KeySource[] = [];
    for (const f of files) {
      const ex = f.extracted as unknown as ExtractedJson;
      const cls = f.classification as unknown as FileClassification | null;
      const single = cls && cls.topics.length === 1 ? cls.topics[0] : null;
      const fill = <T extends { day: number | null; topicNumber: number | null }>(x: T): T => ({
        ...x,
        day: x.day ?? single?.day ?? hint?.day ?? batch.hintDay ?? null,
        topicNumber: x.topicNumber ?? single?.topicNumber ?? hint?.order ?? null,
      });
      sources.push({ fileId: f.id, fileName: f.name, answerKeys: ex.structure.answerKeys.map(fill), keywords: ex.structure.keywords.map(fill) });
      ex.structure.questions.forEach((q, i) => {
        const filled = fill(q);
        raws.push({
          key: `${f.id}:${i}`,
          fileId: f.id,
          fileName: f.name,
          q: filled,
          day: filled.day,
          topicNumber: filled.topicNumber,
          topicTitle: q.topicTitle ?? single?.title ?? null,
          imageIds: q.imageRefs.map((r) => ex.images[r]).filter(Boolean),
        });
      });
    }

    const matches: MatchResult[] = raws.map((r) => matchQuestion(r, sources));
    const clusters = findDuplicates(raws.map((r, i) => ({ text: r.q.text, options: r.q.options, correctIndex: matches[i].correctIndex, hasImage: r.imageIds.length > 0, hasKeys: Boolean(matches[i].questionKey || matches[i].answerKey), fileName: r.fileName })));
    const duplicateOf = new Map<number, number>();
    const conflicts = new Map<number, { fileName: string; answer: string }[]>();
    for (const c of clusters) {
      for (const m of c.members) if (m !== c.primary) duplicateOf.set(m, c.primary);
      if (c.conflict) conflicts.set(c.primary, c.conflict);
      // Asosiy variantda yo'q ma'lumot — dublikatdan (rasm, javob, kalit).
      const p = c.primary;
      for (const m of c.members) {
        if (m === p) continue;
        if (!raws[p].imageIds.length && raws[m].imageIds.length) raws[p].imageIds = raws[m].imageIds;
        if (matches[p].correctIndex === null && matches[m].correctIndex !== null && !c.conflict) {
          const answer = raws[m].q.options[matches[m].correctIndex!];
          const idx = raws[p].q.options.findIndex((o) => textSimilarity(o, answer) > 0.9);
          if (idx >= 0) Object.assign(matches[p], { correctIndex: idx, correctBy: "matched", matchStatus: "matched", answerFrom: { fileId: raws[m].fileId, fileName: raws[m].fileName } });
        }
        if (!matches[p].questionKey && matches[m].questionKey) matches[p].questionKey = matches[m].questionKey;
        if (!matches[p].answerKey && matches[m].answerKey) matches[p].answerKey = matches[m].answerKey;
      }
    }

    const site = prepareSite(
      (
        await this.prisma.question.findMany({
          where: { deletedAt: null, topic: { deletedAt: null } },
          select: { id: true, text: true, topic: { select: { slug: true } }, options: { select: { text: true } } },
        })
      ).map((q) => ({ id: q.id, topicSlug: q.topic.slug, text: q.text, options: q.options.map((o) => o.text) })),
    );

    // Testlar (kun + mavzu guruhlari)
    const courseTopics = await this.prisma.topic.findMany({ where: { kind: "course", deletedAt: null }, select: { slug: true, title: true, titleCyrl: true } });
    const groupKey = (r: RawQuestion) => (r.day !== null || r.topicNumber !== null ? `${r.day ?? "?"}|${r.topicNumber ?? "?"}` : `t|${r.topicTitle ?? r.fileName}`);
    const groups = new Map<string, RawQuestion[]>();
    raws.forEach((r, i) => {
      if (duplicateOf.has(i)) return;
      const k = groupKey(r);
      groups.set(k, [...(groups.get(k) ?? []), r]);
    });
    const testIds = new Map<string, string>();
    let sort = 0;
    const sortedKeys = [...groups.keys()].sort((a, b) => {
      const [da, ta] = a.split("|").map(Number);
      const [db, tb] = b.split("|").map(Number);
      return (da || 99) - (db || 99) || (ta || 99) - (tb || 99);
    });
    for (const k of sortedKeys) {
      const members = groups.get(k)!;
      const first = members[0];
      const title = members.find((m) => m.topicTitle)?.topicTitle ?? null;
      const latnTitle = title ? bothScripts(title).latn : null;
      const slug = first.day && first.topicNumber ? `day${first.day}-topic${first.topicNumber}` : null;
      const course = slug ? courseTopics.find((t) => t.slug === slug) : undefined;
      const titleMatches = course && title ? Math.max(textSimilarity(course.title, title), course.titleCyrl ? textSimilarity(course.titleCyrl, title) : 0) : null;
      const suggestions = courseTopics
        .map((t) => ({ slug: t.slug, title: t.title, score: title ? Math.max(textSimilarity(t.title, title), t.titleCyrl ? textSimilarity(t.titleCyrl, title) : 0) : t.slug === slug ? 1 : 0 }))
        .filter((s) => s.score > 0.35 || s.slug === slug)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      const linked = course && (titleMatches === null || titleMatches >= 0.45) ? course.slug : null;
      const defaultTitle =
        first.day && first.topicNumber ? `${first.day}-kun ${first.topicNumber}-mavzu${latnTitle ? `: ${latnTitle}` : ""}` : (latnTitle ?? first.fileName.replace(/\.[a-z0-9]+$/i, ""));
      const test = await this.prisma.importTest.create({
        data: {
          batchId: batch.id,
          groupId: batch.groupId,
          title: defaultTitle.slice(0, 300),
          day: first.day,
          topicNumber: first.topicNumber,
          topicTitle: title,
          linkedTopicSlug: linked,
          suggestions: suggestions as unknown as Prisma.InputJsonValue,
          sourceFileIds: [...new Set(members.map((m) => m.fileId))] as unknown as Prisma.InputJsonValue,
          sortOrder: sort++,
        },
      });
      testIds.set(k, test.id);
    }

    // Savollar: avval asosiylari, keyin dublikatlar (asosiyga havola bilan).
    const createdId = new Map<number, string>();
    const order = new Map<string, number>();
    const build = (i: number) => {
      const r = raws[i];
      const m = matches[i];
      const t = bothScripts(r.q.text);
      const existsOnSite = duplicateOf.has(i) ? null : findExisting(site, r.q.text, r.q.options);
      const sourcesList: QDraft["sources"] = [{ fileId: r.fileId, fileName: r.fileName, part: "question" }];
      if (m.answerFrom && m.answerFrom.fileId !== r.fileId) sourcesList.push({ ...m.answerFrom, part: "answer" });
      if (m.keysFrom && m.keysFrom.fileId !== r.fileId) sourcesList.push({ ...m.keysFrom, part: "keywords" });
      const data: QDraft = {
        text: { cyrl: t.cyrl, latn: t.latn, ru: "" },
        options: r.q.options.map((o) => ({ ...bothScripts(o), ru: "" })).map(({ cyrl, latn, ru }) => ({ cyrl, latn, ru })),
        script: t.script,
        correctIndex: m.correctIndex,
        correctSource: m.correctIndex !== null ? "file" : null,
        correctBy: m.correctBy,
        aiDoubt: null,
        aiReason: null,
        keywords: { question: m.questionKey, answer: m.answerKey, source: m.keySource },
        explanation: r.q.explanation ? { ...bothScripts(r.q.explanation), ru: "" } : null,
        explanationSource: r.q.explanation ? "file" : null,
        confidence: null,
        problems: [...r.q.notes],
        ruNeedsReview: true,
        sources: sourcesList,
        matchScore: m.matchScore,
        matchCandidate: m.candidate
          ? {
              fileId: m.candidate.fileId,
              fileName: m.candidate.fileName,
              questionText: m.candidate.entry.questionText,
              answerText: m.candidate.entry.answerText,
              optionIndex: null,
              questionKey: m.candidate.entry.questionKey,
              answerKey: m.candidate.entry.answerKey,
            }
          : null,
        existsOnSite,
        analysisAttempts: 0,
        edited: false,
      };
      if (r.q.options.length < 2) data.problems.push("Variantlar 2 tadan kam");
      return { r, m, data, existsOnSite };
    };
    for (let i = 0; i < raws.length; i++) {
      if (duplicateOf.has(i)) continue;
      const { r, m, data, existsOnSite } = build(i);
      const testId = testIds.get(groupKey(r))!;
      const o = (order.get(testId) ?? 0) + 1;
      order.set(testId, o);
      const row = await this.prisma.importQuestion.create({
        data: {
          batchId: batch.id,
          testId,
          sourceFileId: r.fileId,
          order: o,
          number: r.q.number,
          day: r.day,
          topicNumber: r.topicNumber,
          data: data as unknown as Prisma.InputJsonValue,
          matchStatus: m.matchStatus,
          conflict: conflicts.has(i) ? (conflicts.get(i) as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
          existingQuestionId: existsOnSite?.questionId ?? null,
          // Saytda allaqachon bor — standart holatda qo'shilmaydi.
          deleted: Boolean(existsOnSite),
          imageId: r.imageIds[0] ?? null,
        },
      });
      createdId.set(i, row.id);
    }
    for (const [i, p] of duplicateOf) {
      const { r, m, data } = build(i);
      await this.prisma.importQuestion.create({
        data: {
          batchId: batch.id,
          testId: null,
          sourceFileId: r.fileId,
          number: r.q.number,
          day: r.day,
          topicNumber: r.topicNumber,
          data: data as unknown as Prisma.InputJsonValue,
          matchStatus: m.matchStatus,
          duplicateOfId: createdId.get(p) ?? null,
          deleted: true,
          analyzed: true,
          imageId: r.imageIds[0] ?? null,
        },
      });
    }
  }

  // 4. Shubhali juftliklar — AI tasdiqlaydi
  private async stageMatch(batch: ImportBatch): Promise<void> {
    const rows = await this.prisma.importQuestion.findMany({ where: { batchId: batch.id, deleted: false, matchStatus: "unmatched" }, orderBy: { createdAt: "asc" } });
    const pending = rows.filter((r) => (r.data as unknown as QDraft).matchCandidate).slice(0, MATCH_BATCH);
    if (!pending.length || !this.ai.configured()) {
      // AI yo'q — nomzodlar tasdiqlanmagan holda qoladi (admin ko'radi).
      return this.setStage(batch.id, "analyze");
    }
    const decisions = await confirmMatches(
      this.ai,
      pending.map((r) => {
        const d = r.data as unknown as QDraft;
        return { id: r.id, a: d.text[d.script], b: d.matchCandidate!.questionText ?? "" };
      }),
      this.meta(batch),
    );
    for (const r of pending) {
      const d = r.data as unknown as QDraft;
      const cand = d.matchCandidate!;
      let status = r.matchStatus;
      if (decisions.get(r.id)) {
        const res: MatchResult = {
          correctIndex: d.correctIndex,
          correctBy: d.correctBy as MatchResult["correctBy"],
          questionKey: d.keywords.question,
          answerKey: d.keywords.answer,
          keySource: d.keywords.source === "file" ? "file" : null,
          matchStatus: "unmatched",
          matchScore: d.matchScore,
          answerFrom: null,
          keysFrom: null,
          candidate: null,
        };
        const raw = { q: { options: d.options.map((o) => o[d.script]) } } as unknown as RawQuestion;
        applyEntry(res, raw, cand, { number: null, questionText: cand.questionText, answerText: cand.answerText, questionKey: cand.questionKey, answerKey: cand.answerKey, day: null, topicNumber: null }, d.matchScore ?? 0.7, "ai_matched");
        if (res.correctIndex !== null && d.correctIndex === null) {
          d.correctIndex = res.correctIndex;
          d.correctSource = "file";
          d.correctBy = "matched";
          d.sources.push({ fileId: cand.fileId, fileName: cand.fileName, part: "answer" });
        }
        if (res.questionKey || res.answerKey) {
          d.keywords = { question: res.questionKey, answer: res.answerKey, source: "file" };
          d.sources.push({ fileId: cand.fileId, fileName: cand.fileName, part: "keywords" });
        }
        status = "ai_matched";
      }
      d.matchCandidate = null;
      await this.prisma.importQuestion.update({ where: { id: r.id }, data: { data: d as unknown as Prisma.InputJsonValue, matchStatus: status } });
    }
  }

  // 5. Savollar tahlili (Sonnet, rasmlar bilan)
  private async stageAnalyze(batch: ImportBatch): Promise<void> {
    const rows = await this.prisma.importQuestion.findMany({ where: { batchId: batch.id, deleted: false, analyzed: false }, orderBy: [{ testId: "asc" }, { order: "asc" }], take: ANALYZE_BATCH });
    if (!rows.length) return this.setStage(batch.id, "images");
    const withImage = rows.filter((r) => r.imageId).length;
    const take = withImage ? rows.slice(0, ANALYZE_BATCH_WITH_IMAGES) : rows;
    if (!this.ai.configured()) {
      for (const r of take) {
        const d = r.data as unknown as QDraft;
        d.problems = [...d.problems, "AI sozlanmagan — tahlil qilinmadi"];
        d.confidence = d.correctIndex === null ? "low" : "medium";
        await this.prisma.importQuestion.update({ where: { id: r.id }, data: { analyzed: true, data: d as unknown as Prisma.InputJsonValue } });
      }
      return;
    }
    const inputs: AnalyzeInput[] = [];
    for (const r of take) {
      const d = r.data as unknown as QDraft;
      let image: AnalyzeInput["image"] = null;
      if (r.imageId) {
        const img = await this.prisma.importImage.findUnique({ where: { id: r.imageId } });
        if (img) image = { data: (await aiJpeg(await this.storage.get(img.originalKey))).data };
      }
      inputs.push({
        id: r.id,
        text: d.text[d.script],
        options: d.options.map((o) => o[d.script]),
        fileAnswer: d.correctIndex,
        fileKeys: d.keywords.question || d.keywords.answer ? { question: d.keywords.question, answer: d.keywords.answer } : null,
        image,
      });
    }
    let results;
    try {
      results = await analyzeQuestions(this.ai, inputs, this.meta(batch));
    } catch (err) {
      const code = (err as { response?: { code?: string } }).response?.code;
      if (code === "AI_BUDGET_EXCEEDED" || code === "AI_BILLING" || code === "AI_AUTH") throw err;
      for (const r of take) {
        const d = r.data as unknown as QDraft;
        d.analysisAttempts += 1;
        const giveUp = d.analysisAttempts >= MAX_ATTEMPTS;
        if (giveUp) d.problems = [...d.problems, `AI tahlili bajarilmadi: ${err instanceof Error ? err.message.slice(0, 150) : "xato"}`];
        await this.prisma.importQuestion.update({ where: { id: r.id }, data: { analyzed: giveUp, data: d as unknown as Prisma.InputJsonValue } });
      }
      return;
    }
    const byId = new Map(results.map((x) => [x.id, x]));
    for (const r of take) {
      const d = r.data as unknown as QDraft;
      const a = byId.get(r.id);
      if (!a) {
        d.analysisAttempts += 1;
        if (d.analysisAttempts >= MAX_ATTEMPTS) d.problems.push("AI bu savolga javob qaytarmadi");
        await this.prisma.importQuestion.update({ where: { id: r.id }, data: { analyzed: d.analysisAttempts >= MAX_ATTEMPTS, data: d as unknown as Prisma.InputJsonValue } });
        continue;
      }
      applyAnalysis(d, a);
      await this.prisma.importQuestion.update({ where: { id: r.id }, data: { analyzed: true, data: d as unknown as Prisma.InputJsonValue } });
    }
  }

  // 6. Rasmlar
  private async stageImages(batch: ImportBatch): Promise<boolean> {
    const used = await this.prisma.importQuestion.findMany({ where: { batchId: batch.id, deleted: false, imageId: { not: null } }, select: { imageId: true } });
    const ids = [...new Set(used.map((u) => u.imageId!))];
    const images = await this.prisma.importImage.findMany({ where: { batchId: batch.id, id: { in: ids }, status: "pending" }, take: IMAGE_BATCH });
    if (!images.length) {
      const errors = await this.prisma.importFile.count({ where: { batchId: batch.id, status: "error" } });
      const imgErrors = await this.prisma.importImage.count({ where: { batchId: batch.id, status: "error" } });
      await this.setStage(batch.id, "done", { status: errors || imgErrors ? "partial_error" : "review" });
      return false;
    }
    for (const img of images) {
      try {
        await this.processImage(batch, img, null);
      } catch (err) {
        await this.prisma.importImage.update({ where: { id: img.id }, data: { status: "error", error: (err instanceof Error ? err.message : String(err)).slice(0, 1000) } });
      }
    }
    return true;
  }

  /**
   * Bitta rasm: watermark aniqlash (namuna → template matching, keyin AI) → TELEA/NS inpaint
   * (yaxshisi) → chetda bo'lsa crop varianti → AI qayta tekshiruv. `manualBoxes` — admin
   * rasm ustida chizgan to'rtburchaklar (AI aniqlashsiz).
   */
  async processImage(batch: ImportBatch, img: ImportImage, manualBoxes: Box[] | null): Promise<void> {
    const original = await this.storage.get(img.originalKey);
    const rgb = await toRgb(original);
    let boxes: Box[] = manualBoxes ?? [];
    const notes: string[] = [];
    if (!manualBoxes && batch.removeWatermarks) {
      const sample = await this.prisma.appSetting.findUnique({ where: { key: WATERMARK_SAMPLE_KEY } });
      let hint: string | undefined;
      const sampleValue = sample?.value as { storageKey?: string } | undefined;
      if (sampleValue?.storageKey) {
        const found = await templateMatch(rgb, await this.storage.get(sampleValue.storageKey)).catch(() => null);
        if (found) {
          boxes.push(found);
          hint = `a known watermark logo was found by template matching near x=${Math.round(found.x * 100)}%, y=${Math.round(found.y * 100)}%`;
        }
      }
      if (this.ai.configured()) {
        const jpeg = await aiJpeg(original);
        const ai = await detectWatermarkBoxes(this.ai, jpeg, this.meta(batch), hint);
        const aiBoxes = ai.map((b) => ({ x: b.x / jpeg.width, y: b.y / jpeg.height, w: b.w / jpeg.width, h: b.h / jpeg.height, background: b.background }));
        // AI tasdiqlamagan namuna topilmasi ham qoladi (namuna — ishonchli manba).
        boxes = [...boxes, ...aiBoxes];
      } else if (!boxes.length) notes.push("AI sozlanmagan — watermark avtomatik aniqlanmadi");
    }
    const data: Prisma.ImportImageUpdateInput = { width: rgb.width, height: rgb.height, boxes: boxes as unknown as Prisma.InputJsonValue, error: notes.join("; ") || null };
    if (!boxes.length) {
      await this.prisma.importImage.update({ where: { id: img.id }, data: { ...data, status: "done", needsReview: false, selected: "original", cleanedKey: null, cropKey: null } });
      return;
    }
    const cleaned = await inpaintBest(rgb, boxes);
    const cleanedPng = await rgbToPng(cleaned.image);
    const cleanedKey = `imports/${batch.id}/images/${img.id}-cleaned.png`;
    await this.storage.put(cleanedKey, cleanedPng, "image/png");
    const crop = edgeCrop(boxes);
    let cropKey: string | null = null;
    if (crop) {
      cropKey = `imports/${batch.id}/images/${img.id}-crop.png`;
      await this.storage.put(cropKey, await rgbToPng(await cropRgb(rgb, crop)), "image/png");
    }
    let needsReview = false;
    if (this.ai.configured()) {
      const check = await verifyCleaned(this.ai, (await aiJpeg(cleanedPng)).data, this.meta(batch)).catch(() => null);
      if (!check) notes.push("Tozalash AI bilan tekshirilmadi");
      else if (check.residue || check.smudge) {
        needsReview = true;
        notes.push(check.note ?? (check.residue ? "Watermark qoldig'i qoldi" : "Ko'zga tashlanadigan dog' qoldi"));
      }
    } else needsReview = !manualBoxes; // AI'siz: avtomatik tozalashni admin ko'radi; qo'lda chizganini — o'zi ko'rgan
    await this.prisma.importImage.update({
      where: { id: img.id },
      data: { ...data, cleanedKey, cropKey, selected: "cleaned", status: needsReview ? "needs_review" : "done", needsReview, error: notes.join("; ") || null },
    });
  }

  // ───────── Holat va ro'yxat ─────────

  private async mergeStats(batchId: string, patch: BatchStats): Promise<void> {
    const batch = await this.batchOrThrow(batchId);
    await this.prisma.importBatch.update({ where: { id: batchId }, data: { stats: { ...(batch.stats as BatchStats), ...patch } as unknown as Prisma.InputJsonValue } });
  }

  async refreshStats(batchId: string): Promise<BatchStats> {
    const [files, questions, images, tests] = await Promise.all([
      this.prisma.importFile.groupBy({ by: ["status"], where: { batchId, status: { not: "archive" } }, _count: { _all: true } }),
      this.prisma.importQuestion.findMany({ where: { batchId }, select: { deleted: true, analyzed: true, duplicateOfId: true, conflict: true, existingQuestionId: true, matchStatus: true, data: true, imageId: true } }),
      this.prisma.importImage.groupBy({ by: ["status"], where: { batchId }, _count: { _all: true } }),
      this.prisma.importTest.count({ where: { batchId } }),
    ]);
    const fc = (s: string) => files.find((f) => f.status === s)?._count._all ?? 0;
    const total = files.reduce((n, f) => n + f._count._all, 0);
    const live = questions.filter((q) => !q.deleted);
    const ic = (s: string) => images.find((f) => f.status === s)?._count._all ?? 0;
    const stats: BatchStats = {
      files: { total, extracted: total - fc("waiting") - fc("uploaded") - fc("error"), classified: fc("classified"), skipped: fc("skipped"), error: fc("error") },
      questions: {
        total: live.length,
        analyzed: live.filter((q) => q.analyzed).length,
        duplicates: questions.filter((q) => q.duplicateOfId).length,
        conflicts: live.filter((q) => q.conflict !== null).length,
        existing: questions.filter((q) => q.existingQuestionId).length,
        reviewNeeded: live.filter((q) => needsReview(q.data as unknown as QDraft, q.matchStatus, q.conflict !== null)).length,
      },
      images: { total: images.reduce((n, i) => n + i._count._all, 0), done: ic("done") + ic("needs_review"), needsReview: ic("needs_review"), error: ic("error") },
      tests,
    };
    const batch = await this.batchOrThrow(batchId);
    const prev = batch.stats as BatchStats;
    const merged = { ...prev, ...stats };
    await this.prisma.importBatch.update({ where: { id: batchId }, data: { stats: merged as unknown as Prisma.InputJsonValue } });
    return merged;
  }

  async list() {
    const rows = await this.prisma.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { group: { select: { name: true } }, _count: { select: { files: true } } } });
    const admins = await this.prisma.admin.findMany({ where: { id: { in: rows.map((r) => r.createdById).filter((x): x is string => Boolean(x)) } }, select: { id: true, name: true, login: true } });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      stage: r.stage,
      groupName: r.group?.name ?? null,
      fileCount: r._count.files,
      stats: r.stats,
      createdAt: r.createdAt,
      createdBy: admins.find((a) => a.id === r.createdById)?.name ?? null,
      error: r.error,
    }));
  }

  async detail(batchId: string) {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
      include: {
        group: { select: { id: true, name: true } },
        files: { orderBy: { createdAt: "asc" }, select: { id: true, parentId: true, name: true, size: true, status: true, kind: true, skipReason: true, error: true, classification: true, attempts: true } },
        tests: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!batch) throw new NotFoundException("Import topilmadi");
    const counts = await this.prisma.importQuestion.findMany({ where: { batchId, deleted: false, testId: { not: null } }, select: { testId: true, approved: true, data: true, matchStatus: true, conflict: true, imageId: true } });
    const imageReview = new Set((await this.prisma.importImage.findMany({ where: { batchId, OR: [{ needsReview: true }, { status: "error" }] }, select: { id: true } })).map((i) => i.id));
    const budget = await this.ai.budget();
    return {
      ...batch,
      tests: batch.tests.map((t) => {
        const qs = counts.filter((c) => c.testId === t.id);
        return {
          ...t,
          questionCount: qs.length,
          approvedCount: qs.filter((q) => q.approved).length,
          reviewCount: qs.filter((q) => needsReview(q.data as unknown as QDraft, q.matchStatus, q.conflict !== null) || (q.imageId && imageReview.has(q.imageId))).length,
        };
      }),
      budget,
      aiConfigured: this.ai.configured(),
      storage: { driver: this.storage.driverName, maxUploadBytes: this.storage.maxUploadBytes },
    };
  }

  /** Xato bo'lgan faylni qayta urinish (ochish bosqichidan). */
  async retryFile(batchId: string, fileId: string) {
    const file = await this.fileOrThrow(batchId, fileId);
    if (file.status !== "error") throw new BadRequestException("Faqat xato bo'lgan faylni qayta urinish mumkin");
    await this.prisma.importFile.update({ where: { id: fileId }, data: { status: file.storageKey ? "uploaded" : "waiting", error: null } });
    const batch = await this.batchOrThrow(batchId);
    // Ochish bosqichi tugagan bo'lsa — qayta ochib, keyin qolgan bosqichlar.
    if (batch.stage !== "extract") await this.prisma.importBatch.update({ where: { id: batchId }, data: { stage: "extract", status: "uploading" } });
    return this.detail(batchId);
  }

  /** Xato bo'lgan rasmlarni qayta urinish. */
  async retryImages(batchId: string) {
    await this.prisma.importImage.updateMany({ where: { batchId, status: "error" }, data: { status: "pending", error: null } });
    await this.prisma.importBatch.update({ where: { id: batchId }, data: { stage: "images", status: "processing" } });
    return this.detail(batchId);
  }
}

/** Qoidalar bo'yicha tasnif (AI'siz yoki AI ishlamasa). */
export function rulesClassification(s: ExtractedJson["structure"], script: string): FileClassification {
  const withAnswer = s.questions.filter((q) => q.correctIndex !== null).length;
  const kind: FileClassification["kind"] = s.questions.length
    ? withAnswer > s.questions.length / 2
      ? "questions_full"
      : s.answerKeys.length || s.keywords.length
        ? "mixed"
        : "questions_only"
    : s.answerKeys.length || s.keywords.length
      ? "keys_only"
      : "unrelated";
  const topics = new Map<string, { day: number | null; topicNumber: number | null; title: string | null }>();
  for (const h of s.headings) topics.set(`${h.day}|${h.topicNumber}`, { day: h.day, topicNumber: h.topicNumber, title: h.title });
  for (const q of s.questions) if (!topics.has(`${q.day}|${q.topicNumber}`)) topics.set(`${q.day}|${q.topicNumber}`, { day: q.day, topicNumber: q.topicNumber, title: q.topicTitle });
  return {
    kind,
    topics: [...topics.values()],
    questionCount: s.questions.length,
    script: script === "cyrl" || script === "latn" ? script : "mixed",
    language: "uz",
    reason: kind === "unrelated" ? "Savol, javob yoki kalit topilmadi" : null,
    source: "rules",
  };
}

/** AI tahlilini qoralamaga qo'llash: fayldagi javob o'zgarmaydi (shubha bo'lsa — ogohlantirish). */
export function applyAnalysis(d: QDraft, a: { correctIndex: number; doubt: string | null; guessReason: string | null; questionKey: string | null; answerKey: string | null; explanation: string; ru: { text: string; options: string[]; explanation: string }; confidence: "high" | "medium" | "low"; problems: string[] }): void {
  const optCount = d.options.length;
  if (d.correctIndex !== null) {
    if (a.correctIndex !== d.correctIndex || a.doubt) d.aiDoubt = a.doubt ?? `AI boshqa variantni to'g'ri deb hisobladi: F${a.correctIndex + 1}`;
  } else if (a.correctIndex >= 0 && a.correctIndex < optCount) {
    d.correctIndex = a.correctIndex;
    d.correctSource = "ai";
    d.correctBy = null;
    d.aiReason = a.guessReason ?? "Hech bir faylda topilmadi — AI taxmini";
  }
  // Kalitlar: fayldagi bo'lsa o'zgarmaydi; AI taklifi faqat matnda topilsa.
  if (!d.keywords.question && !d.keywords.answer && (a.questionKey || a.answerKey)) {
    const qText = d.text[d.script];
    const ansText = d.correctIndex !== null ? d.options[d.correctIndex]?.[d.script] ?? "" : "";
    const qk = a.questionKey && findPhraseRange(qText, a.questionKey) ? a.questionKey : null;
    const ak = a.answerKey && findPhraseRange(ansText, a.answerKey) ? a.answerKey : null;
    if (qk || ak) d.keywords = { question: qk, answer: ak, source: "ai" };
    if ((a.questionKey && !qk) || (a.answerKey && !ak)) d.problems.push("AI kalit so'zi matnda topilmadi — qo'lda belgilang");
  }
  if (!d.explanation && a.explanation.trim()) {
    const latn = a.explanation.trim();
    d.explanation = { latn, cyrl: latinToCyrillic(latn), ru: a.ru.explanation.trim() };
    d.explanationSource = "ai";
  } else if (d.explanation && !d.explanation.ru) d.explanation.ru = a.ru.explanation.trim();
  if (a.ru.options.length === optCount) {
    d.text.ru = a.ru.text.trim();
    d.options = d.options.map((o, i) => ({ ...o, ru: a.ru.options[i].trim() }));
    d.ruNeedsReview = true;
  } else d.problems.push("Ruscha tarjimada variantlar soni mos emas — tarjima qo'shilmadi");
  d.confidence = a.confidence;
  d.problems = [...new Set([...d.problems, ...a.problems])];
}

/** "Tekshirish kerak": AI javobi, AI shubhasi, ziddiyat, AI juftligi/moslashmagan, past ishonch. */
export function needsReview(d: QDraft, matchStatus: string, conflict: boolean): boolean {
  return (
    d.correctIndex === null ||
    d.correctSource === "ai" ||
    Boolean(d.aiDoubt) ||
    conflict ||
    matchStatus === "ai_matched" ||
    (matchStatus === "unmatched" && d.correctSource !== "file") ||
    d.confidence === "low"
  );
}

export { emptyTexts };
