import { Body, Controller, Get, Headers, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { requestIp } from "../common/request-ip";
import { AuthGuard, CurrentUser } from "./auth.guard";
import { AuthService, type SessionUser } from "./auth.service";
import { CenterLoginDto } from "./center-auth.dto";
import { CenterAuthService } from "./center-auth.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly center: CenterAuthService,
  ) {}

  // Yangi anonim sessiya. Bitta IP daqiqasiga 10 ta — foydalanuvchi
  // jadvalini sun'iy to'ldirishning oldini olish uchun.
  @Post("session")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createSession(@Headers("user-agent") userAgent?: string): Promise<{ token: string; expiresAt: Date }> {
    return this.auth.createAnonymousSession(userAgent);
  }

  /** "Men shu yerda o'qiyman": markaz o'quvchisi telefon + login + parol bilan kiradi. */
  @Post("center/login")
  @HttpCode(200)
  // Markaz sinfi bitta IP'dan kiradi — dars boshida ko'p kirish bo'ladi; asosiy himoya — xato urinishlar hisobi.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  centerLogin(@Body() body: CenterLoginDto, @Req() req: Request, @Headers("user-agent") userAgent?: string) {
    return this.center.login(body, requestIp(req), userAgent);
  }

  /**
   * Yengil "sessiya hali amalda" tekshiruvi (markaz o'quvchisi sahifasi har
   * ~45 s chaqiradi). Tekshiruvning o'zi SessionMiddleware'da — bu yerda
   * faqat 204; bekor qilingan sessiya 401 + kod oladi.
   */
  @Get("check")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  check(): void {}

  @Post("logout")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async logout(@CurrentUser() user: SessionUser): Promise<void> {
    await this.auth.logout(user);
  }
}
