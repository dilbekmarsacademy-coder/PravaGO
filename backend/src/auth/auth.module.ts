import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { SessionMiddleware } from "./session.middleware";

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SessionMiddleware).forRoutes("*");
  }
}
