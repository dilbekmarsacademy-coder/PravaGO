import { Module } from "@nestjs/common";
import { LessonsModule } from "../lessons/lessons.module";
import { QuestionsController } from "./questions.controller";
import { QuestionsService } from "./questions.service";

@Module({
  imports: [LessonsModule],
  controllers: [QuestionsController],
  providers: [QuestionsService],
})
export class QuestionsModule {}
