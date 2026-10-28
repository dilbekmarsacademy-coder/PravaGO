import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Response } from "express";
import { hashToken } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { adminProxyKey, adminSessionSecret, safeEqual } from "./admin-config";
import type { AdminRequest } from "./admin-request";

// `/admin/*` so'rovlari uchun: proxy kalitini va admin sessiyasini aniqlaydi
// (guard'lardan oldin — rate limit admin bo'yicha hisoblanishi uchun).
// Hech narsani rad etmaydi: 401/403 ni AdminGuard qaytaradi.
@Injectable()
export class AdminSessionMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: AdminRequest, _res: Response, next: NextFunction) {
    try {
      const secret = adminSessionSecret();
      const key = req.headers["x-admin-proxy-key"];
      if (!secret || typeof key !== "string" || !safeEqual(key, adminProxyKey(secret))) return next();

      req.adminProxy = true;
      const forwardedIp = req.headers["x-admin-client-ip"];
      if (typeof forwardedIp === "string" && forwardedIp.length <= 100) req.clientIp = forwardedIp;

      const token = req.headers["x-admin-session"];
      if (typeof token !== "string" || token.length < 20 || token.length > 200) return next();
      const session = await this.prisma.adminSession.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { admin: true },
      });
      if (
        session &&
        !session.revokedAt &&
        session.expiresAt.getTime() > Date.now() &&
        session.admin.active
      ) {
        req.admin = {
          id: session.admin.id,
          sessionId: session.id,
          login: session.admin.login,
          name: session.admin.name,
          role: session.admin.role,
        };
      }
      next();
    } catch (err) {
      next(err);
    }
  }
}
