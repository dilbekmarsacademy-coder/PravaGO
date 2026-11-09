import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module";
import { AdminModule } from "../admin/admin.module";
import { AdminFinalExamController, CertificatesController, FinalExamController, PublicCertificatesController } from "./final-exam.controller";
import { FinalExamService } from "./final-exam.service";

@Module({
  imports: [AccessModule, AdminModule],
  controllers: [FinalExamController, CertificatesController, PublicCertificatesController, AdminFinalExamController],
  providers: [FinalExamService],
})
export class FinalExamModule {}
