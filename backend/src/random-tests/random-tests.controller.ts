import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AdminGuard, RequirePermission } from "../admin/admin.guard";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import type { SessionUser } from "../auth/auth.service";
import { AdminRandomTestsQueryDto, AttemptParamDto, ChunkQueryDto, RandomAnswerDto, StartRandomTestDto } from "./random-tests.dto";
import { RandomTestsService } from "./random-tests.service";

/** Kabinet: faqat o'z urinishlari (userId — sessiyadan). Kirish qoidasi "Yangi testlar" bilan bir xil. */
@Controller("random-tests")
@UseGuards(AuthGuard)
export class RandomTestsController {
  constructor(private readonly service: RandomTestsService) {}

  @Get()
  overview(@CurrentUser() user: SessionUser) {
    return this.service.overview(user.id);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  start(@Body() body: StartRandomTestDto, @CurrentUser() user: SessionUser) {
    return this.service.start(user.id, body.size, body.allowFewer ?? false);
  }

  @Get(":id")
  get(@Param() params: AttemptParamDto, @CurrentUser() user: SessionUser) {
    return this.service.get(user.id, params.id);
  }

  @Get(":id/questions")
  questions(@Param() params: AttemptParamDto, @Query() query: ChunkQueryDto, @CurrentUser() user: SessionUser) {
    return this.service.questions(user.id, params.id, query.from, query.count);
  }

  /** Javobni tasdiqlash — daqiqada 40 tagacha (bir savolga bir marta). */
  @Post(":id/answers")
  @HttpCode(200)
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  answer(@Param() params: AttemptParamDto, @Body() body: RandomAnswerDto, @CurrentUser() user: SessionUser) {
    return this.service.answer(user.id, params.id, body.position, body.optionId);
  }

  @Post(":id/finish")
  @HttpCode(200)
  finish(@Param() params: AttemptParamDto, @CurrentUser() user: SessionUser) {
    return this.service.finish(user.id, params.id);
  }
}

/** Admin panel: foydalanuvchilarning random test natijalari (faqat o'qish). */
@Controller("admin/random-tests")
@UseGuards(AdminGuard)
@RequirePermission("users")
export class AdminRandomTestsController {
  constructor(private readonly service: RandomTestsService) {}

  @Get()
  list(@Query() query: AdminRandomTestsQueryDto) {
    return this.service.adminList(query);
  }

  @Get(":id")
  detail(@Param() params: AttemptParamDto) {
    return this.service.adminDetail(params.id);
  }
}
