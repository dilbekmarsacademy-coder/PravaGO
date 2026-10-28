import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { ImageJob, MediaAsset, Prisma } from "@prisma/client";
import { createHash } from "crypto";
import sharp from "sharp";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "../ai/ai.service";
import { AuditService } from "../admin/audit.service";
import type { AdminUser } from "../admin/admin-request";
import { encode, inpaint, previewJpeg, removeBackground, toWorking, type NormRect } from "./image-processing";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Faqat rasm turlari — MIME sarlavhasi emas, fayl kontenti (sharp) bo'yicha tekshiriladi. */
const ALLOWED_FORMATS: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heif: "image/heic", gif: "image/gif" };
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"]);

export type JobType = "auto" | "manual" | "original" | "remove-bg";

export interface JobDto {
  id: string;
  type: string;
  status: string;
  inputAssetId: string;
  outputAssetId: string | null;
  result: unknown;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toJob(job: ImageJob): JobDto {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    inputAssetId: job.inputAssetId,
    outputAssetId: job.outputAssetId,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

/**
 * Og'ir ishni javobdan keyin davom ettirish. Vercel'da `waitUntil` funksiyani
 * vazifa tugaguncha tirik ushlab turadi; boshqa joyda oddiy fon promise.
 */
function runInBackground(task: Promise<unknown>): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { waitUntil } = require("@vercel/functions") as typeof import("@vercel/functions");
    waitUntil(task);
  } catch {
    void task;
  }
}

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly audit: AuditService,
  ) {}

  /** Asl rasm: hajm, MIME va kontent tekshiruvi; ommaga yopiq saqlanadi. */
  async upload(admin: AdminUser, ip: string, file: { buffer: Buffer; mimetype: string; size: number } | undefined): Promise<{ asset: Pick<MediaAsset, "id" | "width" | "height" | "mime" | "size">; job: JobDto }> {
    if (!file?.buffer?.length) throw new BadRequestException("Fayl yuborilmadi");
    if (file.size > MAX_UPLOAD_BYTES || file.buffer.length > MAX_UPLOAD_BYTES) throw new BadRequestException("Rasm 10 MB dan katta");
    if (!ALLOWED_MIME.has(file.mimetype)) throw new BadRequestException("Faqat rasm (JPEG, PNG, WebP, HEIC) yuklash mumkin");
    let meta: sharp.Metadata;
    try {
      meta = await sharp(file.buffer).metadata();
    } catch {
      throw new BadRequestException("Fayl rasm emas yoki buzilgan");
    }
    const mime = meta.format ? ALLOWED_FORMATS[meta.format] : undefined;
    if (!mime || !meta.width || !meta.height) throw new BadRequestException("Fayl rasm emas yoki qo'llab-quvvatlanmaydigan format");
    if (meta.width * meta.height > 40_000_000) throw new BadRequestException("Rasm o'lchami juda katta");
    const asset = await this.prisma.mediaAsset.create({
      data: {
        kind: "original",
        mime,
        width: meta.width,
        height: meta.height,
        size: file.buffer.length,
        sha256: createHash("sha256").update(file.buffer).digest("hex"),
        data: new Uint8Array(file.buffer),
        public: false,
        createdById: admin.id,
      },
      select: { id: true, width: true, height: true, mime: true, size: true },
    });
    await this.audit.log(admin, ip, { action: "image.uploaded", entityType: "image", entityId: asset.id, after: asset });
    const job = await this.createJob(admin, asset.id, "auto", {});
    return { asset, job };
  }

  async createJob(admin: AdminUser, inputAssetId: string, type: JobType, params: { crop?: NormRect; erase?: NormRect[]; trim?: boolean }): Promise<JobDto> {
    const input = await this.prisma.mediaAsset.findUnique({ where: { id: inputAssetId }, select: { id: true } });
    if (!input) throw new NotFoundException("Rasm topilmadi");
    const job = await this.prisma.imageJob.create({
      data: { type, inputAssetId, params: params as Prisma.InputJsonValue, createdById: admin.id },
    });
    runInBackground(this.process(job.id));
    return toJob(job);
  }

  async job(id: string): Promise<JobDto> {
    const job = await this.prisma.imageJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException("Vazifa topilmadi");
    // Fon vazifa yo'qolgan bo'lsa (masalan instance to'xtagan) — 5 daqiqadan keyin xato deb belgilanadi.
    if ((job.status === "queued" || job.status === "running") && Date.now() - job.updatedAt.getTime() > 5 * 60_000) {
      return toJob(await this.prisma.imageJob.update({ where: { id }, data: { status: "failed", error: "Vazifa vaqtida tugamadi — qayta urinib ko'ring" } }));
    }
    return toJob(job);
  }

  private async process(jobId: string): Promise<void> {
    const job = await this.prisma.imageJob.update({ where: { id: jobId }, data: { status: "running" } });
    try {
      const input = await this.prisma.mediaAsset.findUniqueOrThrow({ where: { id: job.inputAssetId } });
      const buffer = Buffer.from(input.data);
      const params = (job.params ?? {}) as { crop?: NormRect; erase?: NormRect[]; trim?: boolean };
      const result: Record<string, unknown> = { aiConfigured: this.ai.configured(), steps: [] as string[] };
      const steps = result.steps as string[];
      let output;

      if (job.type === "remove-bg") {
        output = await removeBackground(buffer);
        steps.push("Fon kesildi (mahalliy model)");
      } else {
        const working = await toWorking(buffer);
        let rects: NormRect[] = [];
        if (job.type === "auto") {
          if (this.ai.configured()) {
            try {
              const boxes = await this.ai.detectWatermarks(await previewJpeg(working));
              result.detections = boxes;
              rects = boxes;
              steps.push(boxes.length ? `AI ${boxes.length} ta watermark/yozuv topdi` : "AI watermark topmadi");
            } catch (err) {
              this.logger.warn(`Watermark aniqlash xatosi: ${String(err)}`);
              result.aiError = "AI aniqlash ishlamadi";
              steps.push("AI aniqlash ishlamadi — qo'lda belgilang");
            }
          } else {
            steps.push("AI aniqlash sozlanmagan");
          }
        } else if (job.type === "manual") {
          rects = params.erase ?? [];
          if (rects.length) steps.push(`${rects.length} ta hudud qo'lda o'chirildi`);
        }
        const pixels = rects.length ? { ...working, data: await inpaint(working, rects) } : working;
        if (rects.length && job.type === "auto") steps.push("Topilgan joylar OpenCV bilan tozalandi");
        const trim = job.type === "auto" ? true : job.type === "manual" ? Boolean(params.trim) : false;
        output = await encode(pixels, { crop: job.type === "manual" ? params.crop : undefined, trim });
        if (params.crop && job.type === "manual") steps.push("Qo'lda qirqildi");
        if (trim) steps.push("Ortiqcha chetlar kesildi");
        steps.push(`WebP, ${output.width}×${output.height}`);
      }

      const asset = await this.prisma.mediaAsset.create({
        data: {
          kind: "processed",
          mime: "image/webp",
          width: output.width,
          height: output.height,
          size: output.data.length,
          sha256: createHash("sha256").update(output.data).digest("hex"),
          data: new Uint8Array(output.data),
          public: false,
          sourceId: input.kind === "original" ? input.id : (input.sourceId ?? input.id),
          createdById: job.createdById,
        },
        select: { id: true },
      });
      await this.prisma.imageJob.update({
        where: { id: jobId },
        data: { status: "done", outputAssetId: asset.id, result: result as Prisma.InputJsonValue },
      });
    } catch (err) {
      this.logger.error(`Rasm vazifasi ${jobId} xato: ${String(err)}`);
      await this.prisma.imageJob
        .update({ where: { id: jobId }, data: { status: "failed", error: String(err instanceof Error ? err.message : err).slice(0, 900) } })
        .catch(() => undefined);
    }
  }

  /**
   * Tasdiqlash: ishlov berilgan (yoki asl rasmdan WebP qilingan) versiya
   * ommaga ochiladi. Asl rasm hech qachon ochilmaydi.
   */
  async accept(admin: AdminUser, ip: string, assetId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId }, select: { id: true, kind: true, width: true, height: true } });
    if (!asset) throw new NotFoundException("Rasm topilmadi");
    if (asset.kind !== "processed") throw new BadRequestException("Faqat ishlov berilgan versiyani tasdiqlash mumkin");
    await this.prisma.mediaAsset.update({ where: { id: assetId }, data: { public: true } });
    await this.audit.log(admin, ip, { action: "image.accepted", entityType: "image", entityId: assetId });
    return { assetId: asset.id, url: `/media/${asset.id}.webp`, width: asset.width, height: asset.height };
  }

  /** Admin ko'rishi uchun (asl va oraliq nusxalar ham). */
  async adminAsset(id: string): Promise<{ data: Buffer; mime: string }> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id }, select: { data: true, mime: true } });
    if (!asset) throw new NotFoundException("Rasm topilmadi");
    return { data: Buffer.from(asset.data), mime: asset.mime };
  }

  /** Sayt uchun — faqat tasdiqlangan (public) rasmlar. */
  async publicAsset(id: string): Promise<{ data: Buffer; mime: string } | null> {
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id, public: true }, select: { data: true, mime: true } });
    return asset ? { data: Buffer.from(asset.data), mime: asset.mime } : null;
  }
}
