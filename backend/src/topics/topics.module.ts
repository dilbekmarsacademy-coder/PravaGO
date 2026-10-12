import { Module } from "@nestjs/common";
import { LessonsModule } from "../lessons/lessons.module";
import { TopicsController } from "./topics.controller";
import { TopicsService } from "./topics.service";

@Module({
  imports: [LessonsModule],
  controllers: [TopicsController],
  providers: [TopicsService],
})
export class TopicsModule {}
