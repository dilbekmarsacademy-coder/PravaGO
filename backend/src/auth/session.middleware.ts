import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { AuthService, type SessionUser } from "./auth.service";

export type RequestWithUser = Request & { user?: SessionUser };

// Guard'lardan OLDIN ishlaydi: `Authorization: Bearer <token>` bo'lsa
// foydalanuvchini `req.user`ga yozadi. Shu tufayli global rate-limit ham
// foydalanuvchi bo'yicha hisoblay oladi (qarang: UserThrottlerGuard).
// Token noto'g'ri bo'lsa hech narsa qilmaydi — 401 ni AuthGuard qaytaradi.
@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private readonly auth: AuthService) {}

  async use(req: RequestWithUser, _res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
    if (match) {
      try {
        req.user = (await this.auth.resolveToken(match[1])) ?? undefined;
      } catch (err) {
        return next(err);
      }
    }
    next();
  }
}
