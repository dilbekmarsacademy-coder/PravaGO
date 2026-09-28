import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { TopicsModule } from "./topics/topics.module";
import { QuestionsModule } from "./questions/questions.module";
import { AuthModule } from "./auth/auth.module";
import { UserThrottlerGuard } from "./auth/user-throttler.guard";
import { SavedModule } from "./saved/saved.module";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        // Default global limit; check-answer endpoint uses a stricter
        // override via @Throttle in its controller.
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    TopicsModule,
    QuestionsModule,
    AuthModule,
    SavedModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      // Sessiyali so'rovlar foydalanuvchi bo'yicha, qolganlari IP bo'yicha.
      useClass: UserThrottlerGuard,
    },
  ],
})
export class AppModule {}
