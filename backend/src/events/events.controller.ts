import { Body, Controller, Headers, HttpCode, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Matches, MaxLength, ValidateNested } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestWithUser } from "../auth/session.middleware";
import { deviceType } from "../common/device";

export const EVENT_TYPES = [
  "page_view",
  "session_start",
  "ping",
  "test_start",
  "test_finish",
  "video_watched",
  "keywords_view",
  "register",
  "payment_request",
] as const;

const ID = /^[A-Za-z0-9_-]{8,40}$/;

class EventDto {
  @IsIn(EVENT_TYPES)
  type: (typeof EVENT_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  path?: string;

  @IsOptional()
  @Matches(/^[a-z0-9-]{1,120}$/)
  topicSlug?: string;

  @IsOptional()
  @IsNumber()
  value?: number;
}

class EventBatchDto {
  @Matches(ID)
  visitorId: string;

  @Matches(ID)
  sessionId: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EventDto)
  events: EventDto[];
}

/**
 * Sayt hodisalari — batch bilan, sessiyasiz ham (bosh sahifa mehmonlari).
 * Saqlanmaydi: IP, User-Agent, ism, telefon. Yo'l (path) so'rov parametrlarisiz.
 */
@Controller("events")
export class EventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async ingest(@Body() body: EventBatchDto, @Req() req: RequestWithUser, @Headers("user-agent") ua?: string): Promise<void> {
    if (body.events.length === 0) return;
    const device = deviceType(ua);
    await this.prisma.analyticsEvent.createMany({
      data: body.events.map((e) => ({
        type: e.type,
        visitorId: body.visitorId,
        sessionId: body.sessionId,
        userId: req.user?.id ?? null,
        path: e.path ? e.path.split(/[?#]/)[0].slice(0, 200) : null,
        topicSlug: e.topicSlug ?? null,
        value: e.value !== undefined && Number.isFinite(e.value) ? e.value : null,
        device,
      })),
    });
  }
}
