import { Body, Controller, Get, HttpCode, Param, Post, Put, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import type { SessionUser } from "../auth/auth.service";
import { LessonsService } from "../lessons/lessons.service";
import {
  ReviewParamDto,
  SetReviewedDto,
  TopicSlugParamDto,
  type KeywordListDto,
  type KeywordProgressDto,
  type ReviewResultDto,
} from "./dto/keywords.dto";
import { KeywordsService } from "./keywords.service";

// "Kalit so'zlar" bo'limi: to'g'ri javoblar va kalit so'zlar shu yerda ochiq
// ko'rinadi, shuning uchun kirish huquqi mavzu testi bilan AYNAN bir xil.
@Controller("topics/:slug/keywords")
@UseGuards(AuthGuard)
export class KeywordsController {
  constructor(
    private readonly keywords: KeywordsService,
    private readonly lessons: LessonsService,
  ) {}

  @Get()
  async list(@CurrentUser() user: SessionUser, @Param() params: TopicSlugParamDto): Promise<KeywordListDto> {
    await this.lessons.assertTopicUnlocked(params.slug, user.id);
    return this.keywords.list(user.id, params.slug);
  }

  /** "Tanishdim" belgilari soni — video ostidagi test darvozasi uchun. */
  @Get("progress")
  async progress(@CurrentUser() user: SessionUser, @Param() params: TopicSlugParamDto): Promise<KeywordProgressDto> {
    await this.lessons.assertTopicUnlocked(params.slug, user.id);
    return this.keywords.progress(user.id, params.slug);
  }

  /**
   * "Tanishib chiqdim" — mavzuning kalit so'zlari bilan tanishildi (oqim
   * yoqilgan foydalanuvchida test shundan keyin ochiladi). Video ko'rilmaguncha 403.
   */
  @Post("viewed")
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async markViewed(@CurrentUser() user: SessionUser, @Param() params: TopicSlugParamDto): Promise<KeywordProgressDto> {
    await this.lessons.assertTopicUnlocked(params.slug, user.id);
    return this.keywords.markViewed(user.id, params.slug);
  }

  /** "Tanishdim" belgisi — foydalanuvchiga bog'lab serverda saqlanadi. */
  @Put(":questionId/review")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async setReviewed(
    @CurrentUser() user: SessionUser,
    @Param() params: ReviewParamDto,
    @Body() body: SetReviewedDto,
  ): Promise<ReviewResultDto> {
    await this.lessons.assertTopicUnlocked(params.slug, user.id);
    return this.keywords.setReviewed(user.id, params.slug, params.questionId, body.reviewed);
  }
}
