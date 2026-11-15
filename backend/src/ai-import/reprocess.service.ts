// Allaqachon saytga chiqqan AI import rasmlarini yangi usul bilan qayta ishlash:
//  - aniq niqob + patch-inpainting (eski usul: butun to'rtburchak + blur/TELEA dog'lari);
//  - asl o'lchamdagi lossless WebP (eski usul: 2× kattalashtirish + sharpen + WebP 92 → 82).
// Faqat ORIGINALI storage'da bor rasmlar (ImportImage.originalKey). Originali yo'q (muharrir orqali
// yuklangan yoki eski) rasmlar o'zgartirilmaydi — ro'yxat qilib qaytariladi.
// dryRun — hech narsa yozmaydi, faqat reja. Haqiqiy ishga tushirish bo'laklab (`limit`), har savol
// alohida auditga yoziladi (eski URL'lar saqlanadi — eski MediaAsset o'chirilmaydi, orqaga qaytarish mumkin).

import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AdminUser } from "../admin/admin-request";
import { AuditService } from "../admin/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { ImportService } from "./import.service";
import { ReviewService } from "./review.service";
import type { Box } from "./image-ops";
import type { QDraft } from "./types";

/** Qayta ishlangan rasmlar: importImageId → yangi katta asset (idempotentlik uchun). */
export const REPROCESS_KEY = "import.image_reprocess_v2";

export interface ReprocessItem {
  questionId: string;
  importImageId: string;
  topicId: string;
  topicTitle: string;
  order: number;
  selected: string;
  /** reclean — watermark yangi usul bilan qayta tozalanadi; lossless — faqat sifatli qayta chiqarish (asl/crop tanlangan). */
  action: "reclean" | "lossless";
  currentUrl: string | null;
}

export interface ReprocessPlan {
  pending: ReprocessItem[];
  done: number;
  /** Originali yo'q yoki import bilan bog'lanmagan rasmlar — o'zgartirilmaydi. */
  withoutOriginal: { questionId: string; topicTitle: string; order: number; imageUrl: string; reason: string }[];
}

@Injectable()
export class ImageReprocessService {
  private readonly logger = new Logger(ImageReprocessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imports: ImportService,
    private readonly review: ReviewService,
    private readonly audit: AuditService,
  ) {}

  private async doneMap(): Promise<Record<string, string>> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: REPROCESS_KEY } });
    return (row?.value as Record<string, string> | null) ?? {};
  }

  async plan(): Promise<ReprocessPlan> {
    const done = await this.doneMap();
    const tests = await this.prisma.importTest.findMany({ where: { publishedTopicId: { not: null } }, select: { id: true, publishedTopicId: true } });
    const pending: ReprocessItem[] = [];
    const mapped = new Set<string>();
    let doneCount = 0;
    for (const t of tests) {
      const topic = await this.prisma.topic.findUnique({ where: { id: t.publishedTopicId! }, select: { id: true, title: true } });
      if (!topic) continue;
      const rows = await this.prisma.importQuestion.findMany({ where: { testId: t.id, deleted: false }, orderBy: { order: "asc" }, select: { data: true, imageId: true } });
      const questions = await this.prisma.question.findMany({ where: { topicId: topic.id }, select: { id: true, order: true, text: true, textLatn: true, imageUrl: true, imageAssetId: true, deletedAt: true } });
      const byOrder = new Map(questions.map((q) => [q.order, q]));
      for (let k = 0; k < rows.length; k++) {
        const row = rows[k];
        const q = byOrder.get(k + 1);
        if (!q || !row.imageId) continue;
        // Nashr paytida savollar shu tartibda yaratilgan; matn ham mos kelishi shart (keyin tahrirlangan/
        // ko'chirilgan bo'lsa — bog'lanmaydi va o'zgartirilmaydi).
        const d = row.data as unknown as QDraft;
        if (q.text !== d.text.cyrl && q.textLatn !== d.text.latn) continue;
        if (q.deletedAt || !q.imageUrl?.startsWith("/media/")) continue;
        mapped.add(q.id);
        const img = await this.prisma.importImage.findUnique({ where: { id: row.imageId }, select: { id: true, selected: true, cleanedKey: true } });
        if (!img) continue;
        if (done[img.id] && q.imageAssetId === done[img.id]) {
          doneCount++;
          continue;
        }
        pending.push({
          questionId: q.id,
          importImageId: img.id,
          topicId: topic.id,
          topicTitle: topic.title,
          order: q.order,
          selected: img.selected,
          action: img.selected === "cleaned" && img.cleanedKey ? "reclean" : "lossless",
          currentUrl: q.imageUrl,
        });
      }
    }
    const others = await this.prisma.question.findMany({
      where: { deletedAt: null, imageUrl: { startsWith: "/media/" } },
      select: { id: true, order: true, imageUrl: true, imageAssetId: true, topic: { select: { title: true } } },
      orderBy: [{ topicId: "asc" }, { order: "asc" }],
    });
    const withoutOriginal: ReprocessPlan["withoutOriginal"] = [];
    for (const q of others) {
      if (mapped.has(q.id)) continue;
      const asset = q.imageAssetId ? await this.prisma.mediaAsset.findUnique({ where: { id: q.imageAssetId }, select: { sourceId: true } }) : null;
      withoutOriginal.push({
        questionId: q.id,
        topicTitle: q.topic.title,
        order: q.order,
        imageUrl: q.imageUrl!,
        reason: asset?.sourceId ? "Savol muharriri orqali yuklangan (AI import emas)" : "AI import bilan bog'lanmadi — asl nusxa topilmadi",
      });
    }
    return { pending, done: doneCount, withoutOriginal };
  }

  /** dryRun — faqat reja; aks holda `limit` tagacha rasm qayta ishlanadi (Vercel vaqt chegarasi uchun bo'laklab). */
  async run(admin: AdminUser | null, ip: string, options: { dryRun: boolean; limit?: number }) {
    const plan = await this.plan();
    if (options.dryRun) {
      return {
        dryRun: true,
        willChange: plan.pending.length,
        reclean: plan.pending.filter((p) => p.action === "reclean").length,
        losslessOnly: plan.pending.filter((p) => p.action === "lossless").length,
        alreadyDone: plan.done,
        pending: plan.pending,
        withoutOriginal: plan.withoutOriginal,
      };
    }
    const limit = Math.min(Math.max(options.limit ?? 5, 1), 25);
    const batch = plan.pending.slice(0, limit);
    const processed: { questionId: string; before: string | null; after: string; action: string }[] = [];
    const failed: { questionId: string; error: string }[] = [];
    // Bir rasm bir nechta savolda bo'lishi mumkin — bir marta ishlanadi.
    const assetsByImage = new Map<string, { large: string; small: string }>();
    for (const item of batch) {
      try {
        let assets = assetsByImage.get(item.importImageId);
        if (!assets) {
          const img = await this.prisma.importImage.findUniqueOrThrow({ where: { id: item.importImageId } });
          if (item.action === "reclean") {
            const imgBatch = await this.imports.batchOrThrow(img.batchId);
            const stored = (img.boxes as unknown as Box[] | null) ?? [];
            // Saqlangan qutilar (AI yoki admin) — qayta AI aniqlash xarajatisiz; ma'lum shablonlar baribir qidiriladi.
            await this.imports.processImage({ ...imgBatch, removeWatermarks: true }, img, stored.length ? stored : null);
            const fresh = await this.prisma.importImage.findUniqueOrThrow({ where: { id: img.id } });
            // Admin tanlovi saqlanadi (tozalangan topilmasa — asl).
            const selected = fresh.cleanedKey ? "cleaned" : "original";
            await this.prisma.importImage.update({ where: { id: img.id }, data: { selected } });
          }
          const current = await this.prisma.importImage.findUniqueOrThrow({ where: { id: img.id } });
          assets = await this.review.publishImageAssets(admin?.id ?? null, current.batchId, current);
          assetsByImage.set(item.importImageId, assets);
        }
        const large = await this.prisma.mediaAsset.findUniqueOrThrow({ where: { id: assets.large }, select: { width: true, height: true } });
        const after = `/media/${assets.large}.webp`;
        await this.prisma.question.update({
          where: { id: item.questionId },
          data: { imageUrl: after, imageSmallUrl: `/media/${assets.small}.webp`, imageAssetId: assets.large, imageWidth: large.width, imageHeight: large.height },
        });
        const map = await this.doneMap();
        map[item.importImageId] = assets.large;
        await this.prisma.appSetting.upsert({ where: { key: REPROCESS_KEY }, create: { key: REPROCESS_KEY, value: map as Prisma.InputJsonValue }, update: { value: map as Prisma.InputJsonValue } });
        if (admin) {
          await this.audit.log(admin, ip, {
            action: "ai_import.image_reprocessed",
            entityType: "question",
            entityId: item.questionId,
            before: { imageUrl: item.currentUrl },
            after: { imageUrl: after, importImageId: item.importImageId, action: item.action },
          });
        }
        processed.push({ questionId: item.questionId, before: item.currentUrl, after, action: item.action });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Rasmni qayta ishlash xatosi (savol ${item.questionId}): ${message}`);
        failed.push({ questionId: item.questionId, error: message.slice(0, 300) });
      }
    }
    if (!batch.length && !plan.pending.length) return { dryRun: false, processed, failed, remaining: 0, withoutOriginal: plan.withoutOriginal.length };
    if (failed.length === batch.length && batch.length) throw new BadRequestException({ message: "Hech bir rasm qayta ishlanmadi", failed });
    return { dryRun: false, processed, failed, remaining: plan.pending.length - processed.length, withoutOriginal: plan.withoutOriginal.length };
  }
}
