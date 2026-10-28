import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { NoStoreMiddleware } from "./common/no-store.middleware";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { TopicsModule } from "./topics/topics.module";
import { QuestionsModule } from "./questions/questions.module";
import { AuthModule } from "./auth/auth.module";
import { UserThrottlerGuard } from "./auth/user-throttler.guard";
import { SavedModule } from "./saved/saved.module";
import { LessonsModule } from "./lessons/lessons.module";
import { KeywordsModule } from "./keywords/keywords.module";
import { AdminModule } from "./admin/admin.module";
import { AccessModule } from "./access/access.module";
import { AccountModule } from "./account/account.module";
import { AiModule } from "./ai/ai.module";
import { ImagesModule } from "./images/images.module";
import { CollectionsModule } from "./collections/collections.module";
import { EventsModule } from "./events/events.module";

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
    AccessModule,
    TopicsModule,
    QuestionsModule,
    AuthModule,
    SavedModule,
    LessonsModule,
    KeywordsModule,
    AdminModule,
    AccountModule,
    AiModule,
    ImagesModule,
    CollectionsModule,
    EventsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      // Sessiyali so'rovlar foydalanuvchi bo'yicha, qolganlari IP bo'yicha.
      useClass: UserThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(NoStoreMiddleware).forRoutes("*");
  }
}
