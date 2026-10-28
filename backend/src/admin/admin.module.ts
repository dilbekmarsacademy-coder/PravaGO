import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AdminAuditController, AdminAuthController } from "./admin-auth.controller";
import { AdminAuthService } from "./admin-auth.service";
import { AdminGuard, AdminProxyGuard } from "./admin.guard";
import { AdminSessionMiddleware } from "./admin-session.middleware";
import { AuditService } from "./audit.service";

@Global()
@Module({
  controllers: [AdminAuthController, AdminAuditController],
  providers: [AdminAuthService, AuditService, AdminGuard, AdminProxyGuard],
  exports: [AuditService, AdminGuard, AdminProxyGuard],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AdminSessionMiddleware).forRoutes("admin/*path");
  }
}
