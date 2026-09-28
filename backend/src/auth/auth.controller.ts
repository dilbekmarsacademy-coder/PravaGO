import { Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Yangi anonim sessiya. Bitta IP daqiqasiga 10 ta — foydalanuvchi
  // jadvalini sun'iy to'ldirishning oldini olish uchun.
  @Post("session")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createSession(): Promise<{ token: string; expiresAt: Date }> {
    return this.auth.createAnonymousSession();
  }
}
