import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AdminGuard, CurrentAdmin, RequestIp, RequirePermission } from "../admin/admin.guard";
import type { AdminUser } from "../admin/admin-request";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import type { SessionUser } from "../auth/auth.service";
import {
  AdminFinalExamQueryDto,
  AdminFinalResetDto,
  AdminFinalUserParamDto,
  CertificateNameDto,
  CertificateParamDto,
  FinalAnswerDto,
  FinalAttemptParamDto,
  FinalSkipDto,
  StartFinalExamDto,
} from "./final-exam.dto";
import { FinalExamService } from "./final-exam.service";

/** Kabinet: yakuniy imtihon (faqat o'z urinishlari, userId — sessiyadan). */
@Controller("final-exam")
@UseGuards(AuthGuard)
export class FinalExamController {
  constructor(private readonly service: FinalExamService) {}

  @Get()
  overview(@CurrentUser() user: SessionUser) {
    return this.service.overview(user.id);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  start(@Body() body: StartFinalExamDto, @CurrentUser() user: SessionUser) {
    return this.service.start(user.id, body.type);
  }

  @Get("attempts/:id")
  get(@Param() params: FinalAttemptParamDto, @CurrentUser() user: SessionUser) {
    return this.service.get(user.id, params.id);
  }

  @Get("attempts/:id/questions")
  questions(@Param() params: FinalAttemptParamDto, @CurrentUser() user: SessionUser) {
    return this.service.questions(user.id, params.id);
  }

  /** Javob — daqiqada 60 tagacha (bir savolga bir marta). */
  @Post("attempts/:id/answers")
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  answer(@Param() params: FinalAttemptParamDto, @Body() body: FinalAnswerDto, @CurrentUser() user: SessionUser) {
    return this.service.answer(user.id, params.id, body.position, body.optionId);
  }

  /** Javobsiz tashlab ketilgan savol — variantlar qayta aralashtiriladi. */
  @Post("attempts/:id/skip")
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  skip(@Param() params: FinalAttemptParamDto, @Body() body: FinalSkipDto, @CurrentUser() user: SessionUser) {
    return this.service.skip(user.id, params.id, body.position);
  }

  @Post("attempts/:id/finish")
  @HttpCode(200)
  finish(@Param() params: FinalAttemptParamDto, @CurrentUser() user: SessionUser) {
    return this.service.finish(user.id, params.id);
  }
}

/** Kabinet: "Sertifikatlar" bo'limi. */
@Controller("certificates")
@UseGuards(AuthGuard)
export class CertificatesController {
  constructor(private readonly service: FinalExamService) {}

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.service.certificates(user.id);
  }

  @Get(":number")
  get(@Param() params: CertificateParamDto, @CurrentUser() user: SessionUser) {
    return this.service.certificate(user.id, params.number);
  }

  @Post(":number/name")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  setName(@Param() params: CertificateParamDto, @Body() body: CertificateNameDto, @CurrentUser() user: SessionUser) {
    return this.service.setCertificateName(user.id, params.number, body.fullName);
  }

  @Post(":number/celebrated")
  @HttpCode(200)
  celebrated(@Param() params: CertificateParamDto, @CurrentUser() user: SessionUser) {
    return this.service.markCelebrated(user.id, params.number);
  }
}

/** Ommaviy tekshirish (/sertifikat/<raqam>) — faqat ism, natija va sana. */
@Controller("public/certificates")
export class PublicCertificatesController {
  constructor(private readonly service: FinalExamService) {}

  @Get(":number")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  verify(@Param() params: CertificateParamDto) {
    return this.service.verify(params.number);
  }
}

/** Admin panel: yakuniy imtihon natijalari va urinishlarni nolga qaytarish. */
@Controller("admin/final-exam")
@UseGuards(AdminGuard)
@RequirePermission("users")
export class AdminFinalExamController {
  constructor(private readonly service: FinalExamService) {}

  @Get()
  list(@Query() query: AdminFinalExamQueryDto) {
    return this.service.adminList(query);
  }

  @Get("users/:userId")
  user(@Param() params: AdminFinalUserParamDto) {
    return this.service.adminUser(params.userId);
  }

  @Post("users/:userId/reset")
  @HttpCode(200)
  reset(@Param() params: AdminFinalUserParamDto, @Body() body: AdminFinalResetDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.service.adminReset(admin, ip, params.userId, body.type);
  }
}
