import { Body, Controller, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import type { SessionUser } from "../auth/auth.service";
import { QuestionsService } from "./questions.service";
import { CheckAnswerDto, CheckAnswerResultDto } from "./dto/check-answer.dto";

@Controller("questions")
@UseGuards(AuthGuard)
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post(":id/check-answer")
  @HttpCode(200)
  // Bitta foydalanuvchi daqiqada ko'pi bilan 20 marta javob tekshira oladi —
  // barcha variantlarni ketma-ket "sinab ko'rish"ning oldini olish uchun.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  checkAnswer(
    @Param("id") id: string,
    @Body() body: CheckAnswerDto,
    @CurrentUser() user: SessionUser,
  ): Promise<CheckAnswerResultDto> {
    return this.questionsService.checkAnswer(id, body.optionId, user.id);
  }
}
