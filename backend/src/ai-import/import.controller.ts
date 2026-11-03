import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";
import type { Response } from "express";
import { AdminGuard, CurrentAdmin, RequestIp, RequirePermission } from "../admin/admin.guard";
import type { AdminUser } from "../admin/admin-request";
import { MAX_IMPORT_FILE_BYTES } from "../storage/storage";
import { ImportService } from "./import.service";
import { ReviewService } from "./review.service";

class FileSpec {
  @IsString()
  @MaxLength(300)
  name: string;

  @IsInt()
  @Min(1)
  size: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  type?: string;
}

class CreateImportDto {
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  newGroupName?: string;

  @IsBoolean()
  removeWatermarks: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  hintDay?: number;

  @IsOptional()
  @Matches(/^day\d+-topic\d+$/)
  hintTopicSlug?: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => FileSpec)
  files: FileSpec[];
}

class TextsDto {
  @IsString()
  @MaxLength(4000)
  cyrl: string;

  @IsString()
  @MaxLength(4000)
  latn: string;

  @IsString()
  @MaxLength(4000)
  ru: string;
}

class KeywordsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  question: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  answer: string | null;
}

class QuestionPatchDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => TextsDto)
  text?: TextsDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => TextsDto)
  options?: TextsDto[];

  @IsOptional()
  @IsInt()
  @Min(-1)
  @Max(5)
  correctIndex?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => KeywordsDto)
  keywords?: KeywordsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TextsDto)
  explanation?: TextsDto;

  @IsOptional()
  @IsBoolean()
  clearExplanation?: boolean;

  @IsOptional()
  @IsUUID()
  testId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  deleted?: boolean;

  @IsOptional()
  @IsBoolean()
  resolveConflict?: boolean;
}

class ApproveDto {
  @IsBoolean()
  approved: boolean;
}

class TestPatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  linkedTopicSlug?: string;

  @IsOptional()
  @IsBoolean()
  unlinkTopic?: boolean;

  @IsOptional()
  @IsUUID()
  groupId?: string;
}

class IdsDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID("4", { each: true })
  ids: string[];
}

class BoxDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  w: number;

  @IsNumber()
  h: number;
}

class RecleanDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => BoxDto)
  boxes?: BoxDto[];
}

class SelectDto {
  @IsIn(["original", "cleaned", "crop"])
  variant: "original" | "cleaned" | "crop";
}

class SampleDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  position?: string;
}

class FilterQuery {
  @IsOptional()
  @IsIn(["all", "review"])
  filter: "all" | "review" = "all";
}

/** "Yangi testlar" → "AI bilan fayllardan qo'shish". Faqat admin (proxy + sessiya). */
@Controller("admin/ai-imports")
@UseGuards(AdminGuard)
@RequirePermission("new-tests")
export class AiImportController {
  constructor(
    private readonly imports: ImportService,
    private readonly review: ReviewService,
  ) {}

  @Get()
  list() {
    return this.imports.list();
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(@Body() body: CreateImportDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.imports.create(admin, ip, body);
  }

  // ── Sozlamalar: watermark namunasi ──

  @Get("settings/watermark")
  watermark() {
    return this.review.watermarkSample();
  }

  @Get("settings/watermark/file")
  async watermarkFile(@Res() res: Response) {
    const data = await this.review.watermarkSampleFile();
    if (!data) return res.status(404).json({ statusCode: 404, message: "Namuna yo'q" });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(data);
  }

  @Post("settings/watermark")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 4 * 1024 * 1024, files: 1 } }))
  setWatermark(@UploadedFile() file: Express.Multer.File | undefined, @Body() body: SampleDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.review.setWatermarkSample(admin, ip, file?.buffer ?? null, body.position ?? null);
  }

  // ── Savollar va rasmlar (ID bo'yicha) ──

  @Patch("questions/:qid")
  updateQuestion(@Param("qid", ParseUUIDPipe) qid: string, @Body() body: QuestionPatchDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    const { clearExplanation, correctIndex, ...rest } = body;
    return this.review.updateQuestion(admin, ip, qid, {
      ...rest,
      ...(correctIndex !== undefined ? { correctIndex: correctIndex < 0 ? null : correctIndex } : {}),
      ...(clearExplanation ? { explanation: null } : {}),
    });
  }

  @Post("questions/:qid/approve")
  @HttpCode(204)
  async approve(@Param("qid", ParseUUIDPipe) qid: string, @Body() body: ApproveDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    await this.review.approveQuestion(admin, ip, qid, body.approved);
  }

  @Post("questions/:qid/image")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 15 * 1024 * 1024, files: 1 } }))
  replaceImage(@Param("qid", ParseUUIDPipe) qid: string, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) return { error: "Fayl yo'q" };
    return this.review.replaceImage(qid, file.buffer);
  }

  @Post("questions/:qid/image/remove")
  @HttpCode(204)
  async removeImage(@Param("qid", ParseUUIDPipe) qid: string) {
    await this.review.removeImage(qid);
  }

  @Get("images/:imgId/:variant")
  async image(@Param("imgId", ParseUUIDPipe) imgId: string, @Param("variant") variant: string, @Res() res: Response) {
    if (!["original", "cleaned", "crop"].includes(variant)) return res.status(404).end();
    const file = await this.review.imageFile(imgId, variant as "original" | "cleaned" | "crop");
    res.setHeader("Content-Type", file.mime);
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.send(file.data);
  }

  @Post("images/:imgId/select")
  @HttpCode(204)
  async select(@Param("imgId", ParseUUIDPipe) imgId: string, @Body() body: SelectDto) {
    await this.review.selectImage(imgId, body.variant);
  }

  @Post("images/:imgId/reclean")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  reclean(@Param("imgId", ParseUUIDPipe) imgId: string, @Body() body: RecleanDto) {
    return this.review.reclean(imgId, body.boxes ?? null);
  }

  // ── Yuklash ──

  @Get(":id")
  detail(@Param("id", ParseUUIDPipe) id: string) {
    return this.imports.detail(id);
  }

  @Post(":id/files/:fileId/upload")
  @HttpCode(204)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_IMPORT_FILE_BYTES, files: 1 } }))
  async upload(@Param("id", ParseUUIDPipe) id: string, @Param("fileId", ParseUUIDPipe) fileId: string, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) return;
    await this.imports.upload(id, fileId, file.buffer);
  }

  @Post(":id/files/:fileId/uploaded")
  @HttpCode(204)
  async uploaded(@Param("id", ParseUUIDPipe) id: string, @Param("fileId", ParseUUIDPipe) fileId: string) {
    await this.imports.markUploaded(id, fileId);
  }

  @Post(":id/files/:fileId/delete")
  @HttpCode(204)
  async removeFile(@Param("id", ParseUUIDPipe) id: string, @Param("fileId", ParseUUIDPipe) fileId: string) {
    await this.imports.removeFile(id, fileId);
  }

  @Post(":id/files/:fileId/retry")
  retryFile(@Param("id", ParseUUIDPipe) id: string, @Param("fileId", ParseUUIDPipe) fileId: string) {
    return this.imports.retryFile(id, fileId);
  }

  // ── Jarayon ──

  @Post(":id/start")
  @HttpCode(200)
  start(@Param("id", ParseUUIDPipe) id: string, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.imports.start(admin, ip, id);
  }

  /** Bitta qadam (≤ 40 s). Sahifa holatni so'rab, `continue` bo'lsa yana chaqiradi. */
  @Post(":id/step")
  @HttpCode(200)
  @Throttle({ default: { limit: 90, ttl: 60_000 } })
  step(@Param("id", ParseUUIDPipe) id: string) {
    return this.imports.step(id);
  }

  @Post(":id/resume")
  @HttpCode(200)
  resume(@Param("id", ParseUUIDPipe) id: string) {
    return this.imports.resume(id);
  }

  @Post(":id/images/retry")
  @HttpCode(200)
  retryImages(@Param("id", ParseUUIDPipe) id: string) {
    return this.imports.retryImages(id);
  }

  // ── Tekshiruv ──

  @Get(":id/tests/:testId/questions")
  questions(@Param("id", ParseUUIDPipe) id: string, @Param("testId", ParseUUIDPipe) testId: string, @Query() query: FilterQuery) {
    return this.review.testQuestions(id, testId, query.filter);
  }

  @Patch(":id/tests/:testId")
  updateTest(@Param("id", ParseUUIDPipe) id: string, @Param("testId", ParseUUIDPipe) testId: string, @Body() body: TestPatchDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    const { unlinkTopic, ...rest } = body;
    return this.review.updateTest(admin, ip, id, testId, { ...rest, ...(unlinkTopic ? { linkedTopicSlug: null } : {}) });
  }

  @Post(":id/tests/:testId/reorder")
  @HttpCode(204)
  async reorder(@Param("testId", ParseUUIDPipe) testId: string, @Body() body: IdsDto) {
    await this.review.reorder(testId, body.ids);
  }

  @Post(":id/tests/:testId/approve-file-answers")
  @HttpCode(200)
  approveFileAnswers(@Param("testId", ParseUUIDPipe) testId: string, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.review.approveFileAnswers(admin, ip, testId);
  }

  @Post(":id/tests/:testId/include-existing")
  @HttpCode(200)
  includeExisting(@Param("id", ParseUUIDPipe) id: string, @Param("testId", ParseUUIDPipe) testId: string, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.imports.includeExisting(admin, ip, id, testId);
  }

  @Post(":id/tests/:testId/publish")
  @HttpCode(200)
  publish(@Param("id", ParseUUIDPipe) id: string, @Param("testId", ParseUUIDPipe) testId: string, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.review.publishTest(admin, ip, id, testId);
  }
}
