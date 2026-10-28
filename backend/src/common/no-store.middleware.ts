import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

// API javoblari keshlanmaydi — admin panelda saqlangan o'zgarish saytda darhol
// ko'rinadi. Rasmlar (/media) o'zining uzoq muddatli keshi bilan qoladi.
@Injectable()
export class NoStoreMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (!req.originalUrl.startsWith("/media/")) res.setHeader("Cache-Control", "no-store");
    next();
  }
}
