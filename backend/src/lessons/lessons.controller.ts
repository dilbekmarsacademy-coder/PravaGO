import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import type { SessionUser } from "../auth/auth.service";
import { LessonIdParamDto, ReportProgressDto, type LessonStatusDto } from "./dto/lesson.dto";
import { LessonsService } from "./lessons.service";
import { AccessService } from "../access/access.service";

// TODO(auth): hozircha "kabinetga kirgan foydalanuvchi" = anonim qurilma
// sessiyasi (AuthGuard). Real login (telefon + OTP) qo'shilganda shu yerda
// akkauntga bog'langan va to'lovi faol foydalanuvchini talab qiling.
@Controller("lessons")
@UseGuards(AuthGuard)
export class LessonsController {
  constructor(
    private readonly lessons: LessonsService,
    private readonly access: AccessService,
  ) {}

  @Get()
  list(@CurrentUser() user: SessionUser): Promise<LessonStatusDto[]> {
    return this.lessons.list(user.id);
  }

  @Get(":lessonId")
  status(@CurrentUser() user: SessionUser, @Param() params: LessonIdParamDto): Promise<LessonStatusDto> {
    return this.lessons.status(user.id, params.lessonId);
  }

  @Get(":lessonId/video")
  async video(@CurrentUser() user: SessionUser, @Param() params: LessonIdParamDto): Promise<{ videoId: string }> {
    await this.access.assertCourseAccess(user.id);
    return this.lessons.video(params.lessonId);
  }

  // Klient har 10–15 s da va pauza/chiqishda yuboradi — daqiqasiga 30 ta yetarli.
  @Post(":lessonId/progress")
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  report(
    @CurrentUser() user: SessionUser,
    @Param() params: LessonIdParamDto,
    @Body() body: ReportProgressDto,
  ): Promise<LessonStatusDto> {
    return this.lessons.reportProgress(user.id, params.lessonId, body);
  }
}
