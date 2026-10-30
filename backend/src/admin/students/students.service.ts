import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizePhone } from "../../common/phone";
import { generateLogin, generatePassword, normalizeLogin } from "../../auth/center-credentials";
import type { AdminUser } from "../admin-request";
import { AuditService } from "../audit.service";
import { hashSecret } from "../password";
import { computeProgress, loadBestPercents, loadCourseTopics, type UserProgress } from "../progress";
import type { CreateStudentDto, StudentsQueryDto, UpdateStudentDto } from "./students.dto";

/** Ochiq parol faqat shu javobda (yaratish / reset) — keyin hech qayerda ko'rsatilmaydi. */
export interface StudentCredentials {
  id: string;
  name: string | null;
  phone: string;
  login: string;
  password: string;
}

export interface StudentRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  login: string | null;
  isActive: boolean;
  centerAccess: boolean;
  lastLoginAt: Date | null;
  lastDevice: string | null;
  lastActiveAt: Date | null;
  /** Hozir biror qurilmada kirgan (faol sessiya bor). */
  online: boolean;
  createdAt: Date;
  progress: UserProgress;
}

const ROW_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  login: true,
  isActive: true,
  centerAccess: true,
  lastLoginAt: true,
  lastDevice: true,
  lastActiveAt: true,
  activeSessionId: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/** Audit uchun — parol xeshisiz. */
const AUDIT_SELECT = { id: true, firstName: true, lastName: true, phone: true, login: true, isActive: true, centerAccess: true } satisfies Prisma.UserSelect;

function splitName(name: string | undefined): { firstName: string | null; lastName: string | null } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  return { firstName: parts[0].slice(0, 60), lastName: parts.slice(1).join(" ").slice(0, 60) || null };
}

function joinName(u: { firstName: string | null; lastName: string | null }): string | null {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
}

const LOGIN_ATTEMPTS = 20;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private phoneOrThrow(raw: string): string {
    const phone = normalizePhone(raw);
    if (!phone) throw new BadRequestException({ statusCode: 400, code: "PHONE_INVALID", message: "Telefon raqam noto'g'ri (+998 XX XXX XX XX)" });
    return phone;
  }

  private async assertPhoneFree(phone: string, exceptId?: string): Promise<void> {
    const owner = await this.prisma.user.findUnique({ where: { phone }, select: { id: true, type: true } });
    if (owner && owner.id !== exceptId) {
      throw new ConflictException({
        statusCode: 409,
        code: "PHONE_TAKEN",
        message: owner.type === "CENTER" ? "Bu raqam bilan markaz o'quvchisi allaqachon qo'shilgan" : "Bu raqam boshqa (o'zi ro'yxatdan o'tgan) foydalanuvchida",
      });
    }
  }

  private async freeLogin(): Promise<string> {
    for (let i = 0; i < LOGIN_ATTEMPTS; i++) {
      const login = generateLogin();
      if (!(await this.prisma.user.findUnique({ where: { login }, select: { id: true } }))) return login;
    }
    throw new ConflictException({ statusCode: 409, code: "LOGIN_GENERATION_FAILED", message: "Login yaratib bo'lmadi, qayta urinib ko'ring" });
  }

  private async studentOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { ...AUDIT_SELECT, type: true } });
    if (!user || user.type !== "CENTER") throw new NotFoundException({ statusCode: 404, code: "STUDENT_NOT_FOUND", message: "O'quvchi topilmadi" });
    return user;
  }

  async list(query: StudentsQueryDto) {
    const and: Prisma.UserWhereInput[] = [{ type: "CENTER" }];
    const q = query.q?.trim();
    if (q) {
      const digits = q.replace(/\D/g, "");
      and.push({
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { login: { contains: q.toLowerCase() } },
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
        ],
      });
    }
    if (query.status === "active") and.push({ isActive: true });
    if (query.status === "inactive") and.push({ isActive: false });
    const where: Prisma.UserWhereInput = { AND: and };
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: ROW_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    const topics = await loadCourseTopics(this.prisma);
    const best = await loadBestPercents(this.prisma, users.map((u) => u.id));
    const items: StudentRow[] = users.map(({ activeSessionId, ...u }) => ({
      ...u,
      online: Boolean(activeSessionId),
      progress: computeProgress(topics, best.get(u.id)),
    }));
    return { total, page: query.page, pageSize: query.pageSize, items };
  }

  private async insert(admin: AdminUser, input: { phone: string; name?: string; login?: string; password?: string }): Promise<StudentCredentials> {
    const phone = this.phoneOrThrow(input.phone);
    await this.assertPhoneFree(phone);
    let login: string;
    if (input.login) {
      login = normalizeLogin(input.login);
      if (await this.prisma.user.findUnique({ where: { login }, select: { id: true } })) {
        throw new ConflictException({ statusCode: 409, code: "LOGIN_TAKEN", message: "Bu login band" });
      }
    } else {
      login = await this.freeLogin();
    }
    const password = input.password ?? generatePassword();
    const { firstName, lastName } = splitName(input.name);
    try {
      const user = await this.prisma.user.create({
        data: {
          type: "CENTER",
          phone,
          login,
          passwordHash: await hashSecret(password),
          firstName,
          lastName,
          createdByAdminId: admin.id,
          // Kabinet "ro'yxatdan o'tgan" foydalanuvchini kutadi — markaz o'quvchisi darhol tayyor.
          registeredAt: new Date(),
        },
        select: { id: true },
      });
      return { id: user.id, name: joinName({ firstName, lastName }), phone, login, password };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = String((err.meta as { target?: unknown } | undefined)?.target ?? "");
        throw new ConflictException(
          target.includes("login")
            ? { statusCode: 409, code: "LOGIN_TAKEN", message: "Bu login band" }
            : { statusCode: 409, code: "PHONE_TAKEN", message: "Bu raqam bilan foydalanuvchi allaqachon bor" },
        );
      }
      throw err;
    }
  }

  async create(admin: AdminUser, ip: string, input: CreateStudentDto): Promise<StudentCredentials> {
    const created = await this.insert(admin, input);
    await this.audit.log(admin, ip, {
      action: "student.created",
      entityType: "user",
      entityId: created.id,
      after: { name: created.name, phone: created.phone, login: created.login, manualLogin: Boolean(input.login), manualPassword: Boolean(input.password) },
    });
    return created;
  }

  /** Ommaviy qo'shish: har bir qator alohida — xato qator qolganlarini to'xtatmaydi. */
  async bulkCreate(admin: AdminUser, ip: string, lines: string[]) {
    const created: StudentCredentials[] = [];
    const errors: { line: number; value: string; message: string }[] = [];
    const seen = new Set<string>();
    for (const [index, raw] of lines.entries()) {
      const value = raw.trim();
      if (!value) continue;
      const phone = normalizePhone(value);
      if (phone && seen.has(phone)) {
        errors.push({ line: index + 1, value, message: "Ro'yxatda takrorlangan" });
        continue;
      }
      if (phone) seen.add(phone);
      try {
        created.push(await this.insert(admin, { phone: value }));
      } catch (err) {
        const message = err instanceof BadRequestException || err instanceof ConflictException ? String((err.getResponse() as { message?: unknown }).message) : "Xatolik";
        errors.push({ line: index + 1, value, message });
      }
    }
    if (created.length) {
      await this.audit.log(admin, ip, {
        action: "student.bulk_created",
        entityType: "user",
        after: { count: created.length, students: created.map((c) => ({ id: c.id, phone: c.phone, login: c.login })), errors: errors.length },
      });
    }
    return { created, errors };
  }

  async update(admin: AdminUser, ip: string, id: string, input: UpdateStudentDto) {
    const before = await this.studentOrThrow(id);
    const data: Prisma.UserUpdateInput = {};
    if (input.name !== undefined) Object.assign(data, splitName(input.name));
    if (input.phone !== undefined) {
      const phone = this.phoneOrThrow(input.phone);
      await this.assertPhoneFree(phone, id);
      data.phone = phone;
    }
    if (input.centerAccess !== undefined) data.centerAccess = input.centerAccess;
    try {
      const after = await this.prisma.user.update({ where: { id }, data, select: AUDIT_SELECT });
      const { type: _type, ...beforeAudit } = before;
      void _type;
      await this.audit.log(admin, ip, { action: "student.updated", entityType: "user", entityId: id, before: beforeAudit, after });
      return after;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException({ statusCode: 409, code: "PHONE_TAKEN", message: "Bu raqam bilan foydalanuvchi allaqachon bor" });
      }
      throw err;
    }
  }

  /** Yangi parol — faol sessiya ham bekor qilinadi (eski qurilma chiqariladi). */
  async resetPassword(admin: AdminUser, ip: string, id: string, manual?: string): Promise<StudentCredentials> {
    const user = await this.studentOrThrow(id);
    const password = manual ?? generatePassword();
    await this.prisma.user.update({ where: { id }, data: { passwordHash: await hashSecret(password), activeSessionId: null } });
    await this.audit.log(admin, ip, { action: "student.password_reset", entityType: "user", entityId: id, after: { login: user.login, manualPassword: Boolean(manual) } });
    return { id, name: joinName(user), phone: user.phone ?? "", login: user.login ?? "", password };
  }

  async setActive(admin: AdminUser, ip: string, id: string, isActive: boolean): Promise<void> {
    await this.studentOrThrow(id);
    await this.prisma.user.update({ where: { id }, data: isActive ? { isActive } : { isActive, activeSessionId: null } });
    await this.audit.log(admin, ip, { action: isActive ? "student.activated" : "student.deactivated", entityType: "user", entityId: id });
  }

  /** "Qurilmadan chiqarish": faol sessiya bekor — qurilma keyingi so'rovda 401 SESSION_REVOKED oladi. */
  async forceLogout(admin: AdminUser, ip: string, id: string): Promise<void> {
    await this.studentOrThrow(id);
    await this.prisma.user.update({ where: { id }, data: { activeSessionId: null } });
    await this.audit.log(admin, ip, { action: "student.logged_out", entityType: "user", entityId: id });
  }

  /** O'chirish: sessiyalar, progress va natijalar ham (cascade). */
  async remove(admin: AdminUser, ip: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id }, select: { ...AUDIT_SELECT, type: true } });
      if (!user || user.type !== "CENTER") throw new NotFoundException({ statusCode: 404, code: "STUDENT_NOT_FOUND", message: "O'quvchi topilmadi" });
      await tx.analyticsEvent.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.user.delete({ where: { id } });
      await this.audit.log(admin, ip, { action: "student.deleted", entityType: "user", entityId: id, before: user }, tx);
    });
  }
}
