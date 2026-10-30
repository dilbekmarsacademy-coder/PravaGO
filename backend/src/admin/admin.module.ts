import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AdminAuditController, AdminAuthController } from "./admin-auth.controller";
import { AdminAuthService } from "./admin-auth.service";
import { AdminGuard, AdminProxyGuard } from "./admin.guard";
import { AdminSessionMiddleware } from "./admin-session.middleware";
import { AuditService } from "./audit.service";
import { PaymentsModule } from "../payments/payments.module";
import { AdminPaymentsController, AdminUsersController } from "./users/admin-users.controller";
import { AdminUsersService } from "./users/admin-users.service";
import { AdminContentController } from "./content/content.controller";
import { ContentService } from "./content/content.service";
import { QuestionEditorService } from "./content/question-editor.service";
import { LessonEditorService } from "./content/lesson-editor.service";
import { LessonsModule } from "../lessons/lessons.module";
import { AdminStatsController, CronController } from "./stats/stats.controller";
import { StatsService } from "./stats/stats.service";
import { AiAnalysisService } from "./stats/ai-analysis.service";

@Global()
@Module({
  imports: [PaymentsModule, LessonsModule],
  controllers: [AdminAuthController, AdminAuditController, AdminUsersController, AdminPaymentsController, AdminContentController, AdminStatsController, CronController],
  providers: [AdminAuthService, AuditService, AdminGuard, AdminProxyGuard, AdminUsersService, ContentService, QuestionEditorService, LessonEditorService, StatsService, AiAnalysisService],
  exports: [AuditService, AdminGuard, AdminProxyGuard, QuestionEditorService],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AdminSessionMiddleware).forRoutes("admin/*path");
  }
}
