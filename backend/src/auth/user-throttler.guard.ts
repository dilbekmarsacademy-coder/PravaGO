import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { SessionUser } from "./auth.service";

/**
 * Rate-limit kaliti: sessiyali so'rovlarda foydalanuvchi, aks holda IP.
 * Soxta tokenlar bilan limitni chetlab o'tib bo'lmaydi — token bazada
 * topilmasa `req.user` bo'sh qoladi va IP ishlatiladi.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as SessionUser | undefined;
    return user ? `user:${user.id}` : `ip:${String(req.ip)}`;
  }
}
