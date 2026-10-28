import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AdminGuard, CurrentAdmin, RequestIp, RequirePermission } from "../admin.guard";
import type { AdminUser } from "../admin-request";
import { AuditService } from "../audit.service";
import { PaymentsService } from "../../payments/payments.service";
import { CreatePaymentDto, PaymentActionDto, PaymentsQueryDto, UserIdParamDto, UsersQueryDto } from "./admin-users.dto";
import { AdminUsersService } from "./admin-users.service";

@Controller("admin/users")
@UseGuards(AdminGuard)
@RequirePermission("users")
export class AdminUsersController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query() query: UsersQueryDto) {
    return this.users.list(query);
  }

  /** CSV (Excel uchun `;` ajratgich, UTF-8 BOM). Eksport ham audit'ga yoziladi — shaxsiy ma'lumot chiqadi. */
  @Get("export.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="foydalanuvchilar.csv"')
  async export(@Query() query: UsersQueryDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string): Promise<string> {
    const csv = await this.users.csv({ ...query, page: 1, pageSize: 200 });
    await this.audit.log(admin, ip, { action: "users.exported", entityType: "user", after: { filters: { q: query.q, payment: query.payment, activity: query.activity } } });
    return csv;
  }

  @Get(":id")
  detail(@Param() params: UserIdParamDto) {
    return this.users.detail(params.id);
  }
}

@Controller("admin/payments")
@UseGuards(AdminGuard)
@RequirePermission("payments")
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@Query() query: PaymentsQueryDto) {
    return this.payments.list(query);
  }

  /** Qo'lda to'lov qo'shish (masalan naqd yoki o'tkazma bilan to'langan). */
  @Post()
  create(@Body() body: CreatePaymentDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.payments.create(admin, ip, body);
  }

  @Post(":id/confirm")
  @HttpCode(200)
  confirm(@Param() params: UserIdParamDto, @Body() body: PaymentActionDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.payments.setStatus(admin, ip, params.id, "CONFIRMED", body.note);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  cancel(@Param() params: UserIdParamDto, @Body() body: PaymentActionDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.payments.setStatus(admin, ip, params.id, "CANCELLED", body.note);
  }
}
