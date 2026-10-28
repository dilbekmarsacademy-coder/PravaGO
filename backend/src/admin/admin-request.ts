import type { AdminRole } from "@prisma/client";
import type { RequestWithUser } from "../auth/session.middleware";

export interface AdminUser {
  id: string;
  sessionId: string;
  login: string;
  name: string;
  role: AdminRole;
}

export type AdminRequest = RequestWithUser & {
  /** So'rov Next.js proxy'sidan kelgan (X-Admin-Proxy-Key to'g'ri). */
  adminProxy?: boolean;
  admin?: AdminUser;
  /** Asl mijoz IP'si (proxy aytgan) yoki to'g'ridan-to'g'ri ulanish IP'si. */
  clientIp?: string;
};

export function clientIp(req: AdminRequest): string {
  return req.clientIp ?? String(req.ip ?? "unknown");
}
