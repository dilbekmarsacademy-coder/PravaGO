import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AdminRole } from "@prisma/client";
import type { AdminRequest, AdminUser } from "./admin-request";

/**
 * Ruxsatlar — rol bo'yicha. Hozircha ikkala rol ham hamma narsaga ruxsatli;
 * cheklash kerak bo'lsa shu jadvalni o'zgartirish kifoya.
 */
export type AdminPermission = "users" | "payments" | "content" | "new-tests" | "stats" | "ai" | "audit" | "admins";

export const ADMIN_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  OWNER: ["users", "payments", "content", "new-tests", "stats", "ai", "audit", "admins"],
  DEVELOPER: ["users", "payments", "content", "new-tests", "stats", "ai", "audit", "admins"],
};

const PERMISSION_KEY = "adminPermission";
/** Controller yoki metodga kerakli ruxsat. */
export const RequirePermission = (permission: AdminPermission) => SetMetadata(PERMISSION_KEY, permission);

export function hasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ADMIN_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Barcha admin API'lari: so'rov Next.js proxy'sidan kelgan (proxy kaliti) va
 * amal qiluvchi admin sessiyasi bor. Oddiy foydalanuvchi tokeni bu yerda hech
 * narsa bermaydi.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    if (!req.adminProxy) throw new ForbiddenException({ statusCode: 403, code: "ADMIN_PROXY_REQUIRED", message: "Ruxsat yo'q" });
    if (!req.admin) throw new UnauthorizedException({ statusCode: 401, code: "ADMIN_SESSION_REQUIRED", message: "Admin sessiyasi topilmadi" });
    const permission = this.reflector.getAllAndOverride<AdminPermission | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (permission && !hasPermission(req.admin.role, permission)) {
      throw new ForbiddenException({ statusCode: 403, code: "ADMIN_FORBIDDEN", message: "Bu amal uchun ruxsat yo'q" });
    }
    return true;
  }
}

/** Faqat proxy orqali kelganini tekshiradi (login endpointi uchun — sessiya hali yo'q). */
@Injectable()
export class AdminProxyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    if (!req.adminProxy) throw new ForbiddenException({ statusCode: 403, code: "ADMIN_PROXY_REQUIRED", message: "Ruxsat yo'q" });
    return true;
  }
}

export const CurrentAdmin = createParamDecorator((_data: unknown, context: ExecutionContext): AdminUser => {
  const req = context.switchToHttp().getRequest<AdminRequest>();
  if (!req.admin) throw new UnauthorizedException({ statusCode: 401, code: "ADMIN_SESSION_REQUIRED", message: "Admin sessiyasi topilmadi" });
  return req.admin;
});

/** So'rov IP'si (audit va rate limit uchun). */
export const RequestIp = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const req = context.switchToHttp().getRequest<AdminRequest>();
  return req.clientIp ?? String(req.ip ?? "unknown");
});
