import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import type { SessionUser } from "./auth.service";
import type { RequestWithUser } from "./session.middleware";

/** Faqat sessiyasi bor so'rovlarni o'tkazadi. Foydalanuvchi SessionMiddleware'da aniqlanadi. */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    if (!req.user) {
      throw new UnauthorizedException("Sessiya topilmadi yoki muddati tugagan");
    }
    return true;
  }
}

/**
 * Joriy foydalanuvchi — faqat sessiyadan. `userId` hech qachon body/query'dan
 * olinmaydi.
 */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): SessionUser => {
  const req = context.switchToHttp().getRequest<RequestWithUser>();
  if (!req.user) throw new UnauthorizedException("Sessiya topilmadi yoki muddati tugagan");
  return req.user;
});
