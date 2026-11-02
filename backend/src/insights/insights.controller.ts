import { Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsIn, IsOptional } from "class-validator";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import type { SessionUser } from "../auth/auth.service";
import { INSIGHT_LOCALES, InsightsService, type InsightDto, type InsightLocale } from "./insights.service";

class LocaleQuery {
  @IsOptional()
  @IsIn(INSIGHT_LOCALES)
  locale: InsightLocale = "uz-latn";
}

/** Kabinet: "Mening tahlilim". userId faqat sessiyadan. */
@Controller("me/insight")
@UseGuards(AuthGuard)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  get(@CurrentUser() user: SessionUser, @Query() query: LocaleQuery): Promise<InsightDto> {
    return this.insights.get(user.id, query.locale);
  }

  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  refresh(@CurrentUser() user: SessionUser, @Query() query: LocaleQuery): Promise<InsightDto> {
    return this.insights.refresh(user.id, query.locale);
  }
}
