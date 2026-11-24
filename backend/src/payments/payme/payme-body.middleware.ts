import { Injectable, NestMiddleware } from "@nestjs/common";
import { json, type NextFunction, type Request, type Response } from "express";

const parse = json({ type: () => true, strict: false, limit: "20kb" });

/**
 * Payme tanani `text/json` bilan ham yuboradi — standart parser uni o'tkazib
 * yuboradi. Allaqachon o'qilgan tana qayta o'qilmaydi; buzuq JSON — `undefined`
 * qoladi va servis -32700 qaytaradi.
 */
@Injectable()
export class PaymeBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    parse(req, res, (err?: unknown) => {
      if (err) req.body = undefined;
      next();
    });
  }
}
