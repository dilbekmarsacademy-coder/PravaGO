import { Injectable, NestMiddleware, UnauthorizedException } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { AuthService, type SessionUser } from "./auth.service";

export type RequestWithUser = Request & { user?: SessionUser };

const REJECTION_MESSAGES = {
  SESSION_REPLACED: "Bu akkauntga boshqa qurilmadan kirildi",
  SESSION_REVOKED: "Sessiya bekor qilingan — qaytadan kiring",
  ACCOUNT_INACTIVE: "Akkaunt faol emas, markazga murojaat qiling",
} as const;

// Guard'lardan OLDIN ishlaydi: `Authorization: Bearer <token>` bo'lsa
// foydalanuvchini `req.user`ga yozadi. Shu tufayli global rate-limit ham
// foydalanuvchi bo'yicha hisoblay oladi (qarang: UserThrottlerGuard).
// Token noto'g'ri bo'lsa hech narsa qilmaydi — 401 ni AuthGuard qaytaradi.
// Token bekor qilingan bo'lsa (boshqa qurilmadan kirilgan, faolsiz akkaunt) —
// HAR QANDAY so'rov darhol 401 + aniq kod oladi: eski qurilmadan yuborilgan
// javoblar va progress qabul qilinmaydi.
@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private readonly auth: AuthService) {}

  async use(req: RequestWithUser, _res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
    if (match) {
      try {
        const resolved = await this.auth.resolveToken(match[1]);
        if (resolved && "rejected" in resolved) {
          const code = resolved.rejected;
          return next(new UnauthorizedException({ statusCode: 401, code, message: REJECTION_MESSAGES[code] }));
        }
        req.user = resolved?.user;
      } catch (err) {
        return next(err);
      }
    }
    next();
  }
}
