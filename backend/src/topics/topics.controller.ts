import { Controller, Get, Param, Req } from "@nestjs/common";
import type { RequestWithUser } from "../auth/session.middleware";
import { LessonsService } from "../lessons/lessons.service";
import { TopicsService } from "./topics.service";
import { PublicQuestionDto } from "./dto/public-question.dto";

@Controller("topics")
export class TopicsController {
  constructor(
    private readonly topicsService: TopicsService,
    private readonly lessons: LessonsService,
  ) {}

  /** Video darsi bor mavzu — dars ko'rilmaguncha 403 (LESSON_NOT_COMPLETED). */
  @Get(":slug/questions")
  async getQuestions(@Param("slug") slug: string, @Req() req: RequestWithUser): Promise<PublicQuestionDto[]> {
    await this.lessons.assertTopicUnlocked(slug, req.user?.id);
    return this.topicsService.getPublicQuestions(slug);
  }
}
