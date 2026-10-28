import { Module } from "@nestjs/common";
import { AdminCollectionsController, AdminQuestionToolsController, CollectionsController } from "./collections.controller";
import { CollectionsService } from "./collections.service";

@Module({
  controllers: [AdminCollectionsController, AdminQuestionToolsController, CollectionsController],
  providers: [CollectionsService],
})
export class CollectionsModule {}
