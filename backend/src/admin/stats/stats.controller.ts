import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, UnauthorizedException, UseGuards } from "@nestjs/common";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { AdminGuard, CurrentAdmin, RequestIp, RequirePermission } from "../admin.guard";
import type { AdminUser } from "../admin-request";
import { safeEqual } from "../admin-config";
import { AiAnalysisService } from "./ai-analysis.service";
import { AiInsightsService } from "./ai-insights.service";
import { StatsService, type RangeKey } from "./stats.service";

class RangeQuery {
  @IsOptional()
  @IsIn(["today", "7d", "30d"])
  range: RangeKey = "7d";
}

class AskDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  question: string;
}

@Controller("admin")
@UseGuards(AdminGuard)
export class AdminStatsController {
  constructor(
    private readonly stats: StatsService,
    private readonly analysis: AiAnalysisService,
    private readonly insights: AiInsightsService,
  ) {}

  @Get("stats/dashboard")
  @RequirePermission("stats")
  dashboard(@Query() query: RangeQuery) {
    return this.stats.dashboard(query.range);
  }

  @Get("ai/reports")
  @RequirePermission("ai")
  async reports() {
    return { configured: this.analysis.configured(), items: await this.analysis.list() };
  }

  @Get("ai/reports/:id")
  @RequirePermission("ai")
  report(@Param("id", ParseUUIDPipe) id: string) {
    return this.analysis.get(id);
  }

  @Post("ai/reports")
  @RequirePermission("ai")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.analysis.generate("manual", admin, ip);
  }

  /** "AI xulosa" — keshdagi (bo'lsa). */
  @Get("ai/summary")
  @RequirePermission("ai")
  summary(@Query() query: RangeQuery) {
    return this.insights.summary(query.range).then((s) => s ?? { text: null });
  }

  @Post("ai/summary")
  @RequirePermission("ai")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  refreshSummary(@Query() query: RangeQuery, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.insights.refreshSummary(admin, ip, query.range);
  }

  /** "Statistikadan so'rash" — AI faqat o'qiydigan metrika funksiyalarini chaqiradi. */
  @Post("ai/ask-stats")
  @RequirePermission("ai")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  askStats(@Body() body: AskDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.insights.ask(admin, ip, body.question);
  }

  @Get("ai/costs")
  @RequirePermission("ai")
  costs() {
    return this.insights.costs();
  }

  @Post("ai/reports/:id/ask")
  @RequirePermission("ai")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  ask(@Param("id", ParseUUIDPipe) id: string, @Body() body: AskDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.analysis.ask(admin, ip, id, body.question);
  }
}

/** Vercel Cron (backend/vercel.json): haftalik AI hisobot. `Authorization: Bearer $CRON_SECRET`. */
@Controller("cron")
@SkipThrottle()
export class CronController {
  constructor(private readonly analysis: AiAnalysisService) {}

  @Get("weekly-report")
  async weekly(@Headers("authorization") auth?: string) {
    const secret = process.env.CRON_SECRET;
    if (!secret || !auth || !safeEqual(auth, `Bearer ${secret}`)) throw new UnauthorizedException();
    if (!this.analysis.configured()) return { skipped: "AI sozlanmagan" };
    const report = await this.analysis.generate("weekly", null, null);
    return { id: report.id };
  }
}
