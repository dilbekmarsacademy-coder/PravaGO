import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { PaymeBodyMiddleware } from "./payme/payme-body.middleware";
import { PaymeController } from "./payme/payme.controller";
import { PaymeService } from "./payme/payme.service";
import { PaymentsService } from "./payments.service";

@Module({
  controllers: [OrdersController, PaymeController],
  providers: [PaymentsService, OrdersService, PaymeService],
  exports: [PaymentsService],
})
export class PaymentsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PaymeBodyMiddleware).forRoutes({ path: "payments/payme", method: RequestMethod.POST });
  }
}
