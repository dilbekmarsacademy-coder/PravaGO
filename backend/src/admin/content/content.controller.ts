import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { IsIn, IsOptional, IsUUID, Matches } from "class-validator";
import { AdminGuard, CurrentAdmin, RequestIp, RequirePermission } from "../admin.guard";
import type { AdminUser } from "../admin-request";
import { ContentService, type QuestionFilter } from "./content.service";
import { QuestionEditorService } from "./question-editor.service";
import { QuestionInputDto } from "./question-input.dto";

class SlugParam {
  @Matches(/^[a-z0-9-]{1,120}$/)
  slug: string;
}

class IdParam {
  @IsUUID()
  id: string;
}

class FilterQuery {
  @IsOptional()
  @IsIn(["all", "needsReview", "noKeywords", "noCorrect"])
  filter: QuestionFilter = "all";
}

@Controller("admin")
@UseGuards(AdminGuard)
@RequirePermission("content")
export class AdminContentController {
  constructor(
    private readonly content: ContentService,
    private readonly editor: QuestionEditorService,
  ) {}

  @Get("content/days")
  days() {
    return this.content.days();
  }

  @Get("content/topics/:slug/questions")
  topicQuestions(@Param() params: SlugParam, @Query() query: FilterQuery) {
    return this.content.topicQuestions(params.slug, query.filter);
  }

  @Get("questions/:id")
  async get(@Param() params: IdParam) {
    const q = await this.editor.load(params.id);
    this.editor.assertEditable(q.topic);
    return this.editor.get(params.id);
  }

  @Put("questions/:id")
  update(@Param() params: IdParam, @Body() body: QuestionInputDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.editor.update(admin, ip, params.id, body);
  }

  @Post("questions/:id/reviewed")
  @HttpCode(200)
  reviewed(@Param() params: IdParam, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.editor.markReviewed(admin, ip, params.id);
  }
}
