import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import type { SessionUser } from "../auth/auth.service";
import {
  CreateSavedDto,
  ListSavedQueryDto,
  QuestionIdParamDto,
  SavedIdsQueryDto,
  UpdateSavedNoteDto,
  type SavedCountDto,
  type SavedListDto,
  type SavedRecordDto,
} from "./dto/saved.dto";
import { SavedService, type PracticeQuestionDto } from "./saved.service";

// Saqlash/o'chirish/izoh: bitta foydalanuvchi daqiqasiga 60 ta.
const MUTATION_LIMIT = { default: { limit: 60, ttl: 60_000 } };

@Controller("saved")
@UseGuards(AuthGuard)
export class SavedController {
  constructor(private readonly saved: SavedService) {}

  /** 201 — yangi saqlandi, 200 — allaqachon saqlangan edi (idempotent). */
  @Post()
  @Throttle(MUTATION_LIMIT)
  async save(
    @CurrentUser() user: SessionUser,
    @Body() body: CreateSavedDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SavedRecordDto> {
    const { record, created } = await this.saved.save(user.id, body);
    res.status(created ? 201 : 200);
    return record;
  }

  @Get()
  list(@CurrentUser() user: SessionUser, @Query() query: ListSavedQueryDto): Promise<SavedListDto> {
    return this.saved.list(user.id, query);
  }

  /** Faqat id'lar — test sahifasidagi xatchop holati uchun (javob/kalit so'z yo'q). */
  @Get("ids")
  async ids(@CurrentUser() user: SessionUser, @Query() query: SavedIdsQueryDto): Promise<{ ids: string[] }> {
    return { ids: await this.saved.ids(user.id, query.topicSlug) };
  }

  @Get("count")
  count(@CurrentUser() user: SessionUser): Promise<SavedCountDto> {
    return this.saved.count(user.id);
  }

  @Get("practice")
  practice(@CurrentUser() user: SessionUser, @Query() query: SavedIdsQueryDto): Promise<PracticeQuestionDto[]> {
    return this.saved.practiceQuestions(user.id, query.topicSlug);
  }

  @Patch(":questionId")
  @Throttle(MUTATION_LIMIT)
  updateNote(
    @CurrentUser() user: SessionUser,
    @Param() params: QuestionIdParamDto,
    @Body() body: UpdateSavedNoteDto,
  ): Promise<SavedRecordDto> {
    return this.saved.updateNote(user.id, params.questionId, body.note ?? null);
  }

  @Delete(":questionId")
  @HttpCode(204)
  @Throttle(MUTATION_LIMIT)
  async remove(@CurrentUser() user: SessionUser, @Param() params: QuestionIdParamDto): Promise<void> {
    await this.saved.remove(user.id, params.questionId);
  }
}
