-- Haqiqiy tariflar. Eski STANDARD/PRO/MAX bilan biror yozuv bo'lsa ::text::"Tariff_new"
-- xato beradi va butun tranzaksiya bekor bo'ladi (ma'lumot yo'qolmaydi).
BEGIN;
CREATE TYPE "Tariff_new" AS ENUM ('STANDART_7', 'STANDART_14', 'STANDART_30', 'PREMIUM', 'MENTOR');
ALTER TABLE "User" ALTER COLUMN "subscriptionTariff" TYPE "Tariff_new" USING ("subscriptionTariff"::text::"Tariff_new");
ALTER TABLE "Order" ALTER COLUMN "tariff" TYPE "Tariff_new" USING ("tariff"::text::"Tariff_new");
ALTER TABLE "Subscription" ALTER COLUMN "tariff" TYPE "Tariff_new" USING ("tariff"::text::"Tariff_new");
ALTER TYPE "Tariff" RENAME TO "Tariff_old";
ALTER TYPE "Tariff_new" RENAME TO "Tariff";
DROP TYPE "Tariff_old";

ALTER TABLE "User" ADD COLUMN "subscriptionUnlimited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ALTER COLUMN "durationDays" DROP NOT NULL;
ALTER TABLE "Subscription" RENAME COLUMN "endsAt" TO "expiresAt";
ALTER TABLE "Subscription" ALTER COLUMN "expiresAt" DROP NOT NULL,
  ALTER COLUMN "durationDays" DROP NOT NULL,
  ADD COLUMN "mentorAssignedAt" TIMESTAMPTZ(3),
  ADD COLUMN "mentorNote" VARCHAR(500);
COMMIT;
