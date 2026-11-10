import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import type { AdminUser } from "../admin/admin-request";
import { safeEqual } from "../admin/admin-config";
import { AdminGuard, CurrentAdmin, RequestIp, RequirePermission } from "../admin/admin.guard";
import type { RequestWithUser } from "../auth/session.middleware";
import { PrismaService } from "../prisma/prisma.service";
import { ArchiveUserParamDto, ArchiveWeekParamDto, ExemptDto, ManualResetDto, WeekParamDto, WeekUsersQueryDto } from "./weekly-reset.dto";
import { WeeklyArchiveService } from "./weekly-archive.service";
import { WeeklyResetService } from "./weekly-reset.service";

/**
 * Ochiq holat: lenta va jonli yangilash uchun (klient 30–60 s da so'raydi).
 * Vaqt — server soati (Asia/Tashkent), mijoz soati ishlatilmaydi. Keshlanmaydi.
 */
@Controller("meta")
export class MetaController {
  constructor(
    private readonly reset: WeeklyResetService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("reset-status")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async status(@Req() req: RequestWithUser) {
    const user = req.user
      ? await this.prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, registeredAt: true, type: true, weeklyResetExempt: true } })
      : null;
    return this.reset.status(
      user ? { id: user.id, registered: Boolean(user.registeredAt) || user.type === "CENTER", exempt: user.weeklyResetExempt } : null,
    );
  }
}

/**
 * Tashqi cron: Vercel Cron (backend/vercel.json, `Authorization: Bearer $CRON_SECRET`)
 * yoki boshqa servis (cron-job.org — `Bearer $RESET_CRON_SECRET`). Idempotent:
 * shu hafta bajarilgan bo'lsa — o'tkazib yuboriladi.
 */
@Controller("cron")
@SkipThrottle()
export class ResetCronController {
  constructor(private readonly reset: WeeklyResetService) {}

  @Get("weekly-reset")
  async run(@Headers("authorization") auth?: string) {
    const secrets = [process.env.RESET_CRON_SECRET, process.env.CRON_SECRET].filter((s): s is string => Boolean(s));
    if (!auth || !secrets.some((s) => safeEqual(auth, `Bearer ${s}`))) throw new UnauthorizedException();
    return this.reset.runWeekly("cron");
  }
}

@Controller("admin/weekly-resets")
@UseGuards(AdminGuard)
@RequirePermission("users")
export class AdminWeeklyResetController {
  constructor(
    private readonly reset: WeeklyResetService,
    private readonly archive: WeeklyArchiveService,
  ) {}

  @Get()
  list() {
    return this.archive.resets();
  }

  /** "Hozir yangilash" (yoki dryRun — faqat hisoblash). "YANGILASH" so'zisiz 400. */
  @Post("run")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async run(@Body() body: ManualResetDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    const result = await this.reset.manual(admin.id, Boolean(body.dryRun));
    if (!result.dryRun) await this.archive.logManual(admin, ip, result);
    return result;
  }

  @Get(":weekKey/users")
  weekUsers(@Param() params: WeekParamDto, @Query() query: WeekUsersQueryDto) {
    return this.archive.weekUsers(params.weekKey, query);
  }
}

@Controller("admin/users/:id")
@UseGuards(AdminGuard)
@RequirePermission("users")
export class AdminUserArchiveController {
  constructor(private readonly archive: WeeklyArchiveService) {}

  @Get("results-archive")
  weeks(@Param() params: ArchiveUserParamDto) {
    return this.archive.userWeeks(params.id);
  }

  @Get("results-archive/:weekKey")
  week(@Param() params: ArchiveWeekParamDto) {
    return this.archive.userWeekDetail(params.id, params.weekKey);
  }

  /** Haftalik yangilanishdan ozod (masalan, "Umar" akkaunti). */
  @Post("weekly-reset-exempt")
  @HttpCode(200)
  exempt(@Param() params: ArchiveUserParamDto, @Body() body: ExemptDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.archive.setExempt(admin, ip, params.id, body.enabled);
  }
}
