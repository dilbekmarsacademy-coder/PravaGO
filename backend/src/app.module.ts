import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { TopicsModule } from "./topics/topics.module";
import { QuestionsModule } from "./questions/questions.module";

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
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
