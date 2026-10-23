import { Module } from "@nestjs/common";
import { LessonsModule } from "../lessons/lessons.module";
import { TopicsController } from "./topics.controller";
import { TopicsService } from "./topics.service";
import { TestAttemptsController } from "./test-attempts.controller";
import { TestAttemptsService } from "./test-attempts.service";

@Module({
  imports: [LessonsModule],
  controllers: [TopicsController, TestAttemptsController],
  providers: [TopicsService, TestAttemptsService],
})
export class TopicsModule {}
