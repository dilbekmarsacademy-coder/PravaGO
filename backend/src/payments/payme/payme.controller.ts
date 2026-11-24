import { Body, Controller, Headers, HttpCode, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { requestIp } from "../../common/request-ip";
import { PaymeService } from "./payme.service";

/** Payme Merchant API (JSON-RPC 2.0). Xatolar ham HTTP 200 bilan qaytadi. */
@Controller("payments/payme")
export class PaymeController {
  constructor(private readonly payme: PaymeService) {}

  @Post()
  @HttpCode(200)
  // Payme bir nechta IP'dan ko'p so'rov yuboradi — haqiqiy IP bo'yicha keng limit.
  @Throttle({ default: { limit: 600, ttl: 60_000, getTracker: (req) => `payme:${requestIp(req as unknown as Request)}` } })
  handle(@Headers("authorization") authorization: string | undefined, @Body() body: unknown) {
    return this.payme.handle(authorization, body);
  }
}
