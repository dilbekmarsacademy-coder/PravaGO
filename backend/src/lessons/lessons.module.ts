import { Module } from "@nestjs/common";
import { LessonsController } from "./lessons.controller";
import { LessonsService } from "./lessons.service";
import { LessonCatalogService } from "./lesson-catalog.service";

@Module({
  controllers: [LessonsController],
  providers: [LessonsService, LessonCatalogService],
  exports: [LessonsService, LessonCatalogService],
})
export class LessonsModule {}
