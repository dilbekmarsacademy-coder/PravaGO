import { Module } from "@nestjs/common";
import { AdminCollectionsController, AdminQuestionToolsController, AdminTestGroupsController, CollectionsController } from "./collections.controller";
import { CollectionsService } from "./collections.service";

@Module({
  controllers: [AdminCollectionsController, AdminTestGroupsController, AdminQuestionToolsController, CollectionsController],
  providers: [CollectionsService],
})
export class CollectionsModule {}
