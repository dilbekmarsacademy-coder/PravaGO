import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { AdminRequest } from "../admin/admin-request";

/**
 * Rate-limit kaliti: admin so'rovlarida admin (yoki proxy aytgan mijoz IP'si),
 * sessiyali so'rovlarda foydalanuvchi, aks holda IP.
 * Soxta tokenlar bilan limitni chetlab o'tib bo'lmaydi — token bazada
 * topilmasa `req.user` bo'sh qoladi va IP ishlatiladi.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(raw: Record<string, unknown>): Promise<string> {
    const req = raw as unknown as AdminRequest;
    if (req.admin) return `admin:${req.admin.id}`;
    if (req.adminProxy && req.clientIp) return `ip:${req.clientIp}`;
    return req.user ? `user:${req.user.id}` : `ip:${String(req.ip)}`;
  }
}
