import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from "class-validator";
import { AdminGuard, CurrentAdmin, RequestIp, RequirePermission } from "../admin.guard";
import type { AdminUser } from "../admin-request";
import { ContentService, type QuestionFilter } from "./content.service";
import { KeywordFillService } from "./keyword-fill.service";
import { LessonEditorService } from "./lesson-editor.service";
import { QuestionEditorService } from "./question-editor.service";
import { QuestionCreateService } from "./question-create.service";
import { PrepareQuestionDto, QuestionInputDto } from "./question-input.dto";

class SlugParam {
  @Matches(/^[a-z0-9-]{1,120}$/)
  slug: string;
}

class IdParam {
  @IsUUID()
  id: string;
}

class FilterQuery {
  @IsOptional()
  @IsIn(["all", "needsReview", "noKeywords", "noCorrect", "pending"])
  filter: QuestionFilter = "all";
}

class FillKeywordsInput {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID("all", { each: true })
  ids: string[];
}

class LessonInput {
  /** YouTube havolasi yoki 11 belgili video ID. */
  @IsString()
  @MaxLength(300)
  video: string;

  @IsInt()
  @Min(1)
  @Max(6 * 60 * 60)
  durationSec: number;
}

@Controller("admin")
@UseGuards(AdminGuard)
@RequirePermission("content")
export class AdminContentController {
  constructor(
    private readonly content: ContentService,
    private readonly editor: QuestionEditorService,
    private readonly lessons: LessonEditorService,
    private readonly creator: QuestionCreateService,
    private readonly keywordFill: KeywordFillService,
  ) {}

  /** Kalit so'zi yo'q yoki biror tilda to'liq bo'lmagan savollar (admin panel ogohlantirishi). */
  @Get("content/keywords/missing")
  missingKeywords() {
    return this.keywordFill.missing();
  }

  /** Yetishmayotgan kalit so'zlarni AI bilan to'ldirish — bir so'rovda 10 tagacha savol. */
  @Post("content/keywords/fill")
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  fillKeywords(@Body() body: FillKeywordsInput, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.keywordFill.fill(admin, ip, body.ids);
  }

  /** Javobi kutilayotgan savollar (admin panel ogohlantirishi). */
  @Get("content/pending")
  pending() {
    return this.content.pending();
  }

  /** "Tugatdim" — javobi belgilangan kutilayotgan savollar saytga chiqadi. */
  @Post("content/pending/publish")
  @HttpCode(200)
  publishPending(@CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.content.publishPending(admin, ip);
  }

  @Get("content/days")
  days() {
    return this.content.days();
  }

  @Get("content/topics/:slug/questions")
  topicQuestions(@Param() params: SlugParam, @Query() query: FilterQuery) {
    return this.content.topicQuestions(params.slug, query.filter);
  }

  /** Yangi savol (lotin) → AI kirill, ruscha va kalit so'zlar. Saqlanmaydi — admin tasdiqlaydi. */
  @Post("content/topics/:slug/questions/prepare")
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  prepareQuestion(@Param() params: SlugParam, @Body() body: PrepareQuestionDto, @CurrentAdmin() admin: AdminUser) {
    return this.creator.prepare(admin, params.slug, body);
  }

  /** Tasdiqlangan yangi savol kun mavzusi testiga qo'shiladi. */
  @Post("content/topics/:slug/questions")
  createQuestion(@Param() params: SlugParam, @Body() body: QuestionInputDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.creator.create(admin, ip, params.slug, body);
  }

  @Get("content/topics/:slug/lesson")
  async lesson(@Param() params: SlugParam) {
    // null JSON sifatida qaytishi uchun obyektga o'raladi.
    return { lesson: await this.lessons.get(params.slug) };
  }

  @Put("content/topics/:slug/lesson")
  updateLesson(@Param() params: SlugParam, @Body() body: LessonInput, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.lessons.update(admin, ip, params.slug, body);
  }

  @Delete("content/topics/:slug/lesson")
  resetLesson(@Param() params: SlugParam, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.lessons.reset(admin, ip, params.slug);
  }

  @Get("questions/:id")
  async get(@Param() params: IdParam) {
    const q = await this.editor.load(params.id);
    this.editor.assertEditable(q.topic);
    return this.editor.get(params.id);
  }

  @Put("questions/:id")
  update(@Param() params: IdParam, @Body() body: QuestionInputDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.editor.update(admin, ip, params.id, body);
  }

  /** Kun mavzusi savolini o'chirish (yumshoq) — tasdiqlash oynasidan keyin. */
  @Delete("content/questions/:id")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  deleteQuestion(@Param() params: IdParam, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.editor.deleteCourseQuestion(admin, ip, params.id);
  }

  @Post("questions/:id/reviewed")
  @HttpCode(200)
  reviewed(@Param() params: IdParam, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.editor.markReviewed(admin, ip, params.id);
  }
}
