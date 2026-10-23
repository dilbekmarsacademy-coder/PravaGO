import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import type { SessionUser } from "../auth/auth.service";
import { LessonsService } from "../lessons/lessons.service";
import { TopicSlugParamDto } from "../keywords/dto/keywords.dto";
import { CreateTestAttemptDto, type TestAttemptDto } from "./dto/test-attempt.dto";
import { TestAttemptsService } from "./test-attempts.service";

@Controller()
@UseGuards(AuthGuard)
export class TestAttemptsController {
  constructor(
    private readonly attempts: TestAttemptsService,
    private readonly lessons: LessonsService,
  ) {}

  @Post("topics/:slug/attempts")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(
    @CurrentUser() user: SessionUser,
    @Param() params: TopicSlugParamDto,
    @Body() body: CreateTestAttemptDto,
  ): Promise<TestAttemptDto> {
    await this.lessons.assertTopicUnlocked(params.slug, user.id);
    return this.attempts.create(user.id, params.slug, body.answers);
  }

  @Get("attempts")
  list(@CurrentUser() user: SessionUser): Promise<TestAttemptDto[]> {
    return this.attempts.list(user.id);
  }
}
