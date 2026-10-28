import { Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module";
import { AccountController } from "./account.controller";
import { AccountService } from "./account.service";

@Module({
  imports: [PaymentsModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
