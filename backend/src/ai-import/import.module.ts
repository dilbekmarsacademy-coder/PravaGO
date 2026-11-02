import { Module } from "@nestjs/common";
import { AiImportController } from "./import.controller";
import { ImportService } from "./import.service";
import { ReviewService } from "./review.service";

@Module({
  controllers: [AiImportController],
  providers: [ImportService, ReviewService],
  exports: [ImportService],
})
export class AiImportModule {}
