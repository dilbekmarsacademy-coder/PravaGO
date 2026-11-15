import { Module } from "@nestjs/common";
import { AiImportController } from "./import.controller";
import { ImportService } from "./import.service";
import { ImageReprocessService } from "./reprocess.service";
import { ReviewService } from "./review.service";

@Module({
  controllers: [AiImportController],
  providers: [ImportService, ReviewService, ImageReprocessService],
  exports: [ImportService],
})
export class AiImportModule {}
