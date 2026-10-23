import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import type { SessionUser } from "../auth/auth.service";
import { LessonsService } from "../lessons/lessons.service";
import { TopicsService } from "./topics.service";
import { PublicQuestionDto } from "./dto/public-question.dto";

@Controller("topics")
@UseGuards(AuthGuard)
export class TopicsController {
  constructor(
    private readonly topicsService: TopicsService,
    private readonly lessons: LessonsService,
  ) {}

  /** Video darsi bor mavzu — dars ko'rilmaguncha 403 (LESSON_NOT_COMPLETED). */
  @Get(":slug/questions")
  async getQuestions(@Param("slug") slug: string, @CurrentUser() user: SessionUser): Promise<PublicQuestionDto[]> {
    await this.lessons.assertTopicUnlocked(slug, user.id);
    return this.topicsService.getPublicQuestions(slug);
  }
}
