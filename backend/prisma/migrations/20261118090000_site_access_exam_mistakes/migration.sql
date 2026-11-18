-- Foydalanuvchi uchun saytni yopish + yakuniy imtihonda 3 xato qoidasi.
-- Faqat yangi ustun/qiymat qo'shiladi: mavjud qiymatlar o'zgarmaydi.

-- Saytni yopish (standart — ochiq).
ALTER TABLE "User" ADD COLUMN "siteAccessBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "blockedAt" TIMESTAMPTZ(3);
ALTER TABLE "User" ADD COLUMN "blockReason" VARCHAR(300);
CREATE INDEX "User_siteAccessBlocked_idx" ON "User"("siteAccessBlocked");

-- Yakuniy imtihon: 3-xatodan keyin to'xtatilgan urinish.
ALTER TYPE "FinalExamStatus" ADD VALUE 'FAILED';
ALTER TABLE "FinalExamAttempt" ADD COLUMN "wrongCount" INTEGER NOT NULL DEFAULT 0;
