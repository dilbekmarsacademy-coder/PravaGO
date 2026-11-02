import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, CurrentUser } from "../auth/auth.guard";
import type { SessionUser } from "../auth/auth.service";
import { AccessService } from "../access/access.service";
import { AdminGuard, CurrentAdmin, RequestIp, RequirePermission } from "../admin/admin.guard";
import type { AdminUser } from "../admin/admin-request";
import { QuestionInputDto } from "../admin/content/question-input.dto";
import { AiService } from "../ai/ai.service";
import { CreateCollectionDto, DeleteGroupDto, GroupNameDto, ReorderDto, SimilarDto, TranslateDto, UpdateCollectionDto } from "./collections.dto";
import { CollectionsService } from "./collections.service";

@Controller("admin/collections")
@UseGuards(AdminGuard)
@RequirePermission("new-tests")
export class AdminCollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  list() {
    return this.collections.list();
  }

  @Post()
  create(@Body() body: CreateCollectionDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.collections.create(admin, ip, body);
  }

  @Post("reorder")
  @HttpCode(200)
  reorder(@Body() body: ReorderDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.collections.reorder(admin, ip, body.ids);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() body: UpdateCollectionDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.collections.update(admin, ip, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id", ParseUUIDPipe) id: string, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    await this.collections.remove(admin, ip, id);
  }

  @Get(":id/questions")
  questions(@Param("id", ParseUUIDPipe) id: string) {
    return this.collections.questions(id);
  }

  @Post(":id/questions")
  createQuestion(@Param("id", ParseUUIDPipe) id: string, @Body() body: QuestionInputDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.collections.createQuestion(admin, ip, id, body);
  }
}

/** "Yangi testlar" to'plamlari: yaratish, nomini o'zgartirish, tartib, o'chirish. */
@Controller("admin/test-groups")
@UseGuards(AdminGuard)
@RequirePermission("new-tests")
export class AdminTestGroupsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  list() {
    return this.collections.groups();
  }

  @Post()
  create(@Body() body: GroupNameDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.collections.createGroup(admin, ip, body.name);
  }

  @Post("reorder")
  @HttpCode(200)
  reorder(@Body() body: ReorderDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.collections.reorderGroups(admin, ip, body.ids);
  }

  @Patch(":id")
  rename(@Param("id", ParseUUIDPipe) id: string, @Body() body: GroupNameDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.collections.renameGroup(admin, ip, id, body.name);
  }

  @Post(":id/delete")
  @HttpCode(204)
  async remove(@Param("id", ParseUUIDPipe) id: string, @Body() body: DeleteGroupDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    await this.collections.removeGroup(admin, ip, id, body.withTests ?? false);
  }
}

@Controller("admin")
@UseGuards(AdminGuard)
export class AdminQuestionToolsController {
  constructor(
    private readonly collections: CollectionsService,
    private readonly ai: AiService,
  ) {}

  @Delete("questions/:id")
  @RequirePermission("new-tests")
  @HttpCode(204)
  async deleteQuestion(@Param("id", ParseUUIDPipe) id: string, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    await this.collections.deleteQuestion(admin, ip, id);
  }

  @Post("questions/similar")
  @RequirePermission("new-tests")
  @HttpCode(200)
  similar(@Body() body: SimilarDto) {
    return this.collections.similar(body.text, body.excludeId);
  }

  @Get("ai/status")
  status() {
    return { configured: this.ai.configured() };
  }

  /** Ruscha AI tarjima (natija needsReview bilan saqlanadi). */
  @Post("ai/translate")
  @RequirePermission("new-tests")
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  translate(@Body() body: TranslateDto, @CurrentAdmin() admin: AdminUser) {
    return this.ai.translateToRussian({ text: body.text, options: body.options, explanation: body.explanation ?? "" }, { adminId: admin.id });
  }
}

/** Kabinetdagi "Yangi testlar" — faqat to'lov qilganlar. */
@Controller("collections")
@UseGuards(AuthGuard)
export class CollectionsController {
  constructor(
    private readonly collections: CollectionsService,
    private readonly access: AccessService,
  ) {}

  @Get()
  async list(@CurrentUser() user: SessionUser) {
    await this.access.assertCourseAccess(user.id);
    return this.collections.published(user.id);
  }

  /** "Yangi testlar": to'plamlar → testlar. */
  @Get("groups")
  async groups(@CurrentUser() user: SessionUser) {
    await this.access.assertCourseAccess(user.id);
    return this.collections.publishedGroups(user.id);
  }
}
