import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { requestIp } from "../common/request-ip";
import { AuthGuard, CurrentUser } from "./auth.guard";
import { AuthService, type SessionUser } from "./auth.service";
import { CenterLoginDto, TransferExchangeDto } from "./center-auth.dto";
import { CenterAuthService } from "./center-auth.service";
import { TransferService, transferSourceOrigins, transferTargetOrigins } from "./transfer.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly center: CenterAuthService,
    private readonly transfer: TransferService,
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

  /**
   * Domen ko'chishi, 1-qadam (eski manzil): joriy sessiya uchun 60 soniyalik
   * bir martalik kod. Faqat eski domendan (Origin) va yaroqli sessiya bilan.
   * Admin panel sessiyasi bilan chaqirilsa — 403 (admin yangi manzilda o'zi kiradi).
   */
  @Post("transfer-code")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  transferCode(@CurrentUser() user: SessionUser, @Req() req: Request, @Headers("origin") origin?: string) {
    this.transfer.assertOrigin(origin, transferSourceOrigins());
    if (req.headers["x-admin-session"] || req.headers["x-admin-proxy-key"]) {
      throw new ForbiddenException({ statusCode: 403, code: "ADMIN_NOT_TRANSFERABLE", message: "Admin yangi manzilda qaytadan kiradi" });
    }
    return this.transfer.createCode(user);
  }

  /** 2-qadam (yangi manzil): kod → yangi sessiya; kod bir marta ishlaydi, yaroqsiz/eskirgan — 401. */
  @Post("transfer-exchange")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  transferExchange(@Body() body: TransferExchangeDto, @Headers("origin") origin?: string, @Headers("user-agent") userAgent?: string) {
    this.transfer.assertOrigin(origin, transferTargetOrigins());
    return this.transfer.exchange(body.code, userAgent);
  }

  @Post("logout")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async logout(@CurrentUser() user: SessionUser): Promise<void> {
    await this.auth.logout(user);
  }
}
