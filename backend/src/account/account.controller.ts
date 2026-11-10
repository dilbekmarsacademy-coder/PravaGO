import { Body, Controller, Get, HttpCode, Post, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import { requestIp } from "../common/request-ip";
import type { SessionUser } from "../auth/auth.service";
import { PaymentsService, type MyPaymentDto } from "../payments/payments.service";
import { LanguageDto, PaymentRequestDto, RegisterDto } from "./account.dto";
import { AccountService, type MeDto } from "./account.service";

@Controller()
@UseGuards(AuthGuard)
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly payments: PaymentsService,
  ) {}

  @Get("me")
  me(@CurrentUser() user: SessionUser): Promise<MeDto> {
    return this.account.me(user.id);
  }

  @Post("me/register")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  register(@CurrentUser() user: SessionUser, @Body() body: RegisterDto, @Req() req: Request): Promise<MeDto> {
    return this.account.register(user.id, body, requestIp(req));
  }

  @Put("me/language")
  @HttpCode(204)
  async language(@CurrentUser() user: SessionUser, @Body() body: LanguageDto): Promise<void> {
    await this.account.setLanguage(user.id, body.preferredLanguage);
  }

  /** /tolov: "kutilmoqda" to'lov so'rovi — admin panelda tasdiqlanadi. */
  @Post("payments/request")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  request(@CurrentUser() user: SessionUser, @Body() body: PaymentRequestDto): Promise<MyPaymentDto> {
    return this.payments.request(user.id, body.note?.trim() || undefined);
  }

  @Get("payments/mine")
  mine(@CurrentUser() user: SessionUser): Promise<MyPaymentDto[]> {
    return this.payments.mine(user.id);
  }
}
