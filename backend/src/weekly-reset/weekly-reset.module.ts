import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AdminModule } from "../admin/admin.module";
import { AdminUserArchiveController, AdminWeeklyResetController, MetaController, ResetCronController } from "./weekly-reset.controller";
import { WeeklyArchiveService } from "./weekly-archive.service";
import { WeeklyResetService } from "./weekly-reset.service";

@Module({
  imports: [ScheduleModule.forRoot(), AdminModule],
  controllers: [MetaController, ResetCronController, AdminWeeklyResetController, AdminUserArchiveController],
  providers: [WeeklyResetService, WeeklyArchiveService],
  exports: [WeeklyResetService],
})
export class WeeklyResetModule {}
