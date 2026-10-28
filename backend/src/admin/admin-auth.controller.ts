import { Body, Controller, Get, Headers, HttpCode, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AdminGuard, AdminProxyGuard, CurrentAdmin, RequestIp, RequirePermission } from "./admin.guard";
import type { AdminUser } from "./admin-request";
import { AdminAuthService, type AdminProfileDto } from "./admin-auth.service";
import { AuditService } from "./audit.service";
import { AdminLoginDto, AuditQueryDto, ChangePasswordDto } from "./dto/admin-auth.dto";

@Controller("admin/auth")
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  // Asosiy cheklov bazada (5 / 15 daqiqa, IP va login bo'yicha) — bu yerdagisi
  // faqat bitta instance'ga yog'ilgan so'rovlarni qo'shimcha to'xtatadi.
  @Post("login")
  @HttpCode(200)
  @UseGuards(AdminProxyGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() body: AdminLoginDto, @RequestIp() ip: string, @Headers("user-agent") userAgent?: string) {
    return this.auth.login(body, ip, userAgent);
  }

  @Post("logout")
  @HttpCode(204)
  @UseGuards(AdminGuard)
  async logout(@CurrentAdmin() admin: AdminUser, @RequestIp() ip: string): Promise<void> {
    await this.auth.logout(admin, ip);
  }

  @Get("me")
  @UseGuards(AdminGuard)
  me(@CurrentAdmin() admin: AdminUser): Promise<AdminProfileDto> {
    return this.auth.me(admin);
  }

  @Post("change-password")
  @HttpCode(204)
  @UseGuards(AdminGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async changePassword(@CurrentAdmin() admin: AdminUser, @Body() body: ChangePasswordDto, @RequestIp() ip: string): Promise<void> {
    await this.auth.changePassword(admin, body.currentPassword, body.newPassword, ip);
  }
}

@Controller("admin/audit")
@UseGuards(AdminGuard)
@RequirePermission("audit")
export class AdminAuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly auth: AdminAuthService,
  ) {}

  @Get()
  list(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }

  @Get("logins")
  logins() {
    return this.auth.loginAttempts(100);
  }
}
