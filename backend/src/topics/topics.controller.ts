import { Controller, Get, Param } from "@nestjs/common";
import { TopicsService } from "./topics.service";
import { PublicQuestionDto } from "./dto/public-question.dto";

@Controller("topics")
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Get(":slug/questions")
  getQuestions(@Param("slug") slug: string): Promise<PublicQuestionDto[]> {
    return this.topicsService.getPublicQuestions(slug);
  }
}
