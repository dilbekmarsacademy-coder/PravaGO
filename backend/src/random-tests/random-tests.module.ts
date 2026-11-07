import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module";
import { AdminRandomTestsController, RandomTestsController } from "./random-tests.controller";
import { RandomTestsService } from "./random-tests.service";

@Module({
  imports: [AccessModule],
  controllers: [RandomTestsController, AdminRandomTestsController],
  providers: [RandomTestsService],
})
export class RandomTestsModule {}
