import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AdminUser } from "./admin-request";

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

/** JSON'ga yaroqli nusxa (Date → ISO, Buffer → olib tashlanadi). */
function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === undefined || value === null) return Prisma.DbNull;
  return JSON.parse(
    JSON.stringify(value, (_key, v: unknown) => (Buffer.isBuffer(v) || v instanceof Uint8Array ? "[binary]" : v)),
  ) as Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(admin: Pick<AdminUser, "id"> | null, ip: string | null, entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    await (tx ?? this.prisma).auditLog.create({
      data: {
        adminId: admin?.id ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: toJson(entry.before),
        after: toJson(entry.after),
        ip,
      },
    });
  }

  async list(params: { page: number; pageSize: number; entityType?: string; entityId?: string; adminId?: string }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(params.entityType ? { entityType: params.entityType } : {}),
      ...(params.entityId ? { entityId: params.entityId } : {}),
      ...(params.adminId ? { adminId: params.adminId } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: { admin: { select: { login: true, name: true } } },
      }),
    ]);
    return {
      total,
      page: params.page,
      pageSize: params.pageSize,
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        before: r.before,
        after: r.after,
        ip: r.ip,
        createdAt: r.createdAt,
        admin: r.admin ? { login: r.admin.login, name: r.admin.name } : null,
      })),
    };
  }
}
