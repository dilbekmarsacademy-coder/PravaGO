import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(
    helmet({
      // Savol rasmlari frontend bilan boshqa origin'da (masalan turli
      // portlar/domenlar) joylashadi — brauzer ularni <img>/next/image
      // orqali yuklay olishi uchun CORP "same-origin" bo'lmasligi kerak.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  app.enableCors({
    origin: allowedOrigin ? allowedOrigin.split(",") : false,
    methods: ["GET", "POST"],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // process.cwd() (not __dirname) so this resolves the same whether run
  // via `nest start` (src/) or `node dist/main.js` (dist/src/) — both are
  // always launched from the backend/ project root.
  app.useStaticAssets(join(process.cwd(), "public"), {
    prefix: "/",
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  console.log(`PravaTayyor backend ${port}-portda ishga tushdi`);
}

bootstrap();
