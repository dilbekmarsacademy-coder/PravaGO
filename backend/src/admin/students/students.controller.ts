import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AdminGuard, CurrentAdmin, RequestIp, RequirePermission } from "../admin.guard";
import type { AdminUser } from "../admin-request";
import { BulkCreateStudentsDto, CreateStudentDto, ResetPasswordDto, StudentIdParamDto, StudentsQueryDto, UpdateStudentDto } from "./students.dto";
import { StudentsService } from "./students.service";

/** "Shu yerda o'qiydiganlar" — markaz o'quvchilari (type=CENTER). */
@Controller("admin/students")
@UseGuards(AdminGuard)
@RequirePermission("users")
export class AdminStudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  list(@Query() query: StudentsQueryDto) {
    return this.students.list(query);
  }

  @Post()
  create(@Body() body: CreateStudentDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.students.create(admin, ip, body);
  }

  @Post("bulk")
  bulk(@Body() body: BulkCreateStudentsDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.students.bulkCreate(admin, ip, body.phones);
  }

  @Patch(":id")
  update(@Param() params: StudentIdParamDto, @Body() body: UpdateStudentDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.students.update(admin, ip, params.id, body);
  }

  @Post(":id/reset-password")
  @HttpCode(200)
  resetPassword(@Param() params: StudentIdParamDto, @Body() body: ResetPasswordDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.students.resetPassword(admin, ip, params.id, body.password);
  }

  @Post(":id/activate")
  @HttpCode(204)
  async activate(@Param() params: StudentIdParamDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string): Promise<void> {
    await this.students.setActive(admin, ip, params.id, true);
  }

  @Post(":id/deactivate")
  @HttpCode(204)
  async deactivate(@Param() params: StudentIdParamDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string): Promise<void> {
    await this.students.setActive(admin, ip, params.id, false);
  }

  @Post(":id/logout")
  @HttpCode(204)
  async logout(@Param() params: StudentIdParamDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string): Promise<void> {
    await this.students.forceLogout(admin, ip, params.id);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param() params: StudentIdParamDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string): Promise<void> {
    await this.students.remove(admin, ip, params.id);
  }
}
