import { Module } from "@nestjs/common";
import { KeywordsModule } from "../keywords/keywords.module";
import { LessonsModule } from "../lessons/lessons.module";
import { TopicsController } from "./topics.controller";
import { TopicsService } from "./topics.service";
import { TestAttemptsController } from "./test-attempts.controller";
import { TestAttemptsService } from "./test-attempts.service";

@Module({
  imports: [LessonsModule, KeywordsModule],
  controllers: [TopicsController, TestAttemptsController],
  providers: [TopicsService, TestAttemptsService],
})
export class TopicsModule {}
