import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AdminAuditController, AdminAuthController } from "./admin-auth.controller";
import { AdminAuthService } from "./admin-auth.service";
import { AdminGuard, AdminProxyGuard } from "./admin.guard";
import { AdminSessionMiddleware } from "./admin-session.middleware";
import { AuditService } from "./audit.service";
import { PaymentsModule } from "../payments/payments.module";
import { AdminPaymentsController, AdminUsersController } from "./users/admin-users.controller";
import { AdminUsersService } from "./users/admin-users.service";

@Global()
@Module({
  imports: [PaymentsModule],
  controllers: [AdminAuthController, AdminAuditController, AdminUsersController, AdminPaymentsController],
  providers: [AdminAuthService, AuditService, AdminGuard, AdminProxyGuard, AdminUsersService],
  exports: [AuditService, AdminGuard, AdminProxyGuard],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AdminSessionMiddleware).forRoutes("admin/*path");
  }
}
