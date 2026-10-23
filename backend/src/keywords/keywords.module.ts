import { Module } from "@nestjs/common";
import { LessonsModule } from "../lessons/lessons.module";
import { KeywordsController } from "./keywords.controller";
import { KeywordsService } from "./keywords.service";

@Module({
  imports: [LessonsModule],
  controllers: [KeywordsController],
  providers: [KeywordsService],
})
export class KeywordsModule {}
