import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Tariff } from "@prisma/client";
import { IsIn, IsUUID } from "class-validator";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import type { SessionUser } from "../auth/auth.service";
import type { RequestWithUser } from "../auth/session.middleware";
import { OrdersService } from "./orders.service";
import { TARIFF_IDS } from "./tariffs";

export class CreateOrderDto {
  @IsIn(TARIFF_IDS)
  tariff: Tariff;
}

export class OrderParamDto {
  @IsUUID()
  id: string;
}

@Controller("payments")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** Ommaviy: narxlar va onlayn to'lov yoqilganmi (bazaga murojaat yo'q). */
  @Get("tariffs")
  tariffs(@Req() req: RequestWithUser) {
    return this.orders.tariffs(req.user?.id);
  }

  @Post("create-order")
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@CurrentUser() user: SessionUser, @Body() body: CreateOrderDto) {
    return this.orders.create(user.id, body.tariff);
  }

  @Get("order/:id")
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  order(@CurrentUser() user: SessionUser, @Param() params: OrderParamDto) {
    return this.orders.get(user.id, params.id);
  }
}
